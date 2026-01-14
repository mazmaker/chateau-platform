// Edge Function: Invite User
// Creates a user in Supabase Auth and generates a signup link

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify the requestor is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    // Parse request body
    const { email, fullName, tenantId, role, redirectTo } = await req.json()

    // Validate input
    if (!email || !fullName || !tenantId || !role) {
      throw new Error('Missing required fields: email, fullName, tenantId, role')
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with user's auth context
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get the current user
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if the inviter has permission to invite users
    // Use RPC function to bypass RLS and get user by auth_user_id
    const { data: inviterData, error: inviterError } = await userSupabase.rpc('get_user_by_auth_id', {
      p_auth_id: user.id
    })

    if (inviterError || !inviterData?.success) {
      throw new Error('Inviter not found in public.users')
    }

    const inviter = {
      id: inviterData.id,
      role: inviterData.role,
      tenant_id: inviterData.tenant_id
    }

    // Check permission: owner can invite to any tenant, admin only to their own
    if (inviter.role !== 'owner' && inviter.tenant_id !== tenantId) {
      throw new Error('Insufficient permissions: Admin can only invite to their own tenant')
    }

    // Call invite_user_v2 function to create pending user record
    const { data: inviteData, error: inviteError } = await userSupabase.rpc('invite_user_v2', {
      p_email: email,
      p_full_name: fullName,
      p_tenant_id: tenantId,
      p_role: role,
      p_invited_by: inviter.id,  // Use public user ID, not auth user ID
      p_redirect_url: redirectTo
    })

    if (inviteError || !inviteData?.success) {
      const errorMsg = inviteError?.message || inviteData?.error || 'Failed to create invite'
      throw new Error(errorMsg)
    }

    // Check if this is a resend (user already had pending invite)
    if (inviteData.is_resend) {
      // For resend, just return existing token
      const baseUrl = redirectTo || `${new URL(req.url).origin}/auth/setup-password`
      const inviteUrl = `${baseUrl}?token=${inviteData.signup_token}`

      return new Response(
        JSON.stringify({
          success: true,
          user_id: inviteData.user_id,
          email: inviteData.email,
          invite_url: inviteUrl,
          message: inviteData.message || 'Invite resent successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // For new invites, create user in auth.users using Supabase Admin API
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Generate a temporary password (user will change it)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 16)

    // Create user in auth.users
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: tenantId,
        role: role,
        invited_by: user.id,
        signup_token: inviteData.signup_token,
      },
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      // Rollback: delete from public.users
      await userSupabase.from('users').delete().eq('id', inviteData.user_id)
      throw new Error(authError.message || 'Failed to create auth user')
    }

    // Update the users table with the auth user ID
    await userSupabase
      .from('users')
      .update({ auth_user_id: authData.user.id })
      .eq('id', inviteData.user_id)

    // Log the activity
    try {
      await userSupabase.rpc('log_activity', {
        p_tenant_id: tenantId,
        p_user_id: inviteData.user_id,
        p_activity_type: 'user_invited',
        p_description: `User invited: ${fullName} (${email.toLowerCase()})`,
        p_metadata: {
          email: email.toLowerCase(),
          role: role,
          invited_by: inviter.id,  // Use public user ID
        },
      })
    } catch (logError) {
      console.error('Error logging activity:', logError)
    }

    // Construct the invite URL
    const baseUrl = redirectTo || `${new URL(req.url).origin}/auth/setup-password`
    const inviteUrl = `${baseUrl}?token=${inviteData.signup_token}`

    return new Response(
      JSON.stringify({
        success: true,
        user_id: inviteData.user_id,
        email: email.toLowerCase(),
        auth_user_id: authData.user.id,
        invite_url: inviteUrl,
        message: 'User invited successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in invite-user function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
