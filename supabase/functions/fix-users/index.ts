// Edge Function: Fix Users Without Auth
// Creates auth.users for users that only exist in public.users

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get users without auth_user_id
    const { data: users, error: fetchError } = await adminSupabase
      .from('users')
      .select('id, email, full_name, role, tenant_id')
      .is('auth_user_id', null)
      .is('is_active', true)

    if (fetchError) {
      throw fetchError
    }

    const results = []

    for (const user of users || []) {
      // Generate temp password
      const tempPassword = crypto.randomUUID().slice(0, 16)

      try {
        // Try to create auth user
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
          email: user.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: user.full_name,
            tenant_id: user.tenant_id,
            role: user.role,
          },
        })

        if (authError) {
          // Check if user already exists in auth
          const { data: { users: existingUsers } } = await adminSupabase.auth.admin.listUsers()
          const existingUser = existingUsers?.find((u: any) => u.email === user.email)

          if (existingUser) {
            // Link existing auth user
            await adminSupabase
              .from('users')
              .update({ auth_user_id: existingUser.id })
              .eq('id', user.id)

            results.push({
              email: user.email,
              status: 'linked_to_existing',
              authUserId: existingUser.id
            })
          } else {
            results.push({
              email: user.email,
              status: 'failed',
              error: authError.message
            })
          }
          continue
        }

        // Update user with auth_user_id
        await adminSupabase
          .from('users')
          .update({ auth_user_id: authData.user.id })
          .eq('id', user.id)

        results.push({
          email: user.email,
          status: 'created',
          authUserId: authData.user.id,
          tempPassword: tempPassword // Only shown once!
        })

      } catch (err: any) {
        results.push({
          email: user.email,
          status: 'error',
          error: err.message
        })
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        message: `Processed ${results.length} users`
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in fix-users function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
