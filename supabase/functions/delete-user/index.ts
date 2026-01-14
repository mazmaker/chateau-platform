// Edge Function: Delete User
// Deletes user from both auth.users and public.users

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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Missing authorization header')
    }

    const { userId } = await req.json()

    if (!userId) {
      throw new Error('Missing userId')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client with user's auth context
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    })

    // Get current user to verify permissions
    const { data: { user }, error: userError } = await userSupabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get the user to be deleted (to check tenant and role)
    const { data: targetUser } = await userSupabase
      .from('users')
      .select('id, email, tenant_id, role, auth_user_id')
      .eq('id', userId)
      .single()

    if (!targetUser) {
      throw new Error('User not found')
    }

    // Get current user's role
    const { data: currentUser } = await userSupabase
      .from('users')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .single()

    if (!currentUser) {
      throw new Error('Current user not found')
    }

    // Permission check: owner can delete anyone, admin can only delete from their tenant
    if (currentUser.role !== 'owner' && currentUser.tenant_id !== targetUser.tenant_id) {
      throw new Error('Insufficient permissions')
    }

    // Cannot delete owner
    if (targetUser.role === 'owner') {
      throw new Error('Cannot delete owner')
    }

    // Use service role client for admin operations
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Delete from auth.users if auth_user_id exists
    if (targetUser.auth_user_id) {
      const { error: authDeleteError } = await adminSupabase.auth.admin.deleteUser(
        targetUser.auth_user_id
      )

      if (authDeleteError) {
        console.error('Error deleting from auth.users:', authDeleteError)
        // Continue anyway - try to delete from public.users at least
      }
    }

    // Delete from public.users using admin client to bypass RLS
    const { error: deleteError } = await adminSupabase
      .from('users')
      .delete()
      .eq('id', userId)

    if (deleteError) {
      throw deleteError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'User deleted successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
