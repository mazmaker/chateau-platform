// Edge Function: Accept Invite & Signup
// Creates user in auth.users and lets them set their password directly

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { inviteToken, password } = await req.json()

    if (!inviteToken || !password) {
      throw new Error('Missing inviteToken or password')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client for querying database (anon key is fine for reading)
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    // Admin client for creating users
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Find pending user by invite token
    const { data: pendingUser, error: findError } = await supabase
      .from('users')
      .select('*')
      .or(`invite_token.eq.${inviteToken},signup_token.eq.${inviteToken}`)
      .maybeSingle()

    if (findError || !pendingUser) {
      throw new Error('Invalid or expired invite link')
    }

    // Check if already active
    if (pendingUser.is_active) {
      throw new Error('This invite has already been accepted')
    }

    // Check if token has expired
    if (pendingUser.signup_expires_at && new Date(pendingUser.signup_expires_at) < new Date()) {
      throw new Error('Invite link has expired')
    }

    // Check if auth user already exists
    if (pendingUser.auth_user_id) {
      // User already exists in auth, just update password
      const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
        pendingUser.auth_user_id,
        { password }
      )

      if (updateError) {
        throw new Error(`Failed to update password: ${updateError.message}`)
      }

      // Activate the user
      await supabase
        .from('users')
        .update({
          is_active: true,
          password_set_at: new Date().toISOString(),
          signup_token: null,
          invite_token: null,
          invite_accepted_at: new Date().toISOString(),
        })
        .eq('id', pendingUser.id)

      return new Response(
        JSON.stringify({
          success: true,
          email: pendingUser.email,
          message: 'Password updated successfully',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // Create new user in auth.users
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
      email: pendingUser.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: pendingUser.full_name,
        tenant_id: pendingUser.tenant_id,
        role: pendingUser.role,
      },
    })

    if (authError) {
      throw new Error(`Failed to create user: ${authError.message}`)
    }

    // Update public.users with auth_user_id and activate
    await supabase
      .from('users')
      .update({
        is_active: true,
        auth_user_id: authData.user.id,
        password_set_at: new Date().toISOString(),
        signup_token: null,
        invite_token: null,
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('id', pendingUser.id)

    return new Response(
      JSON.stringify({
        success: true,
        user_id: pendingUser.id,
        email: pendingUser.email,
        message: 'Account created successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in accept-invite function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
