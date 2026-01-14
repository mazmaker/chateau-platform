// Edge Function: Reset User Password
// Resets password for a specific user (admin function)

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
    const { email, newPassword } = await req.json()

    if (!email || !newPassword) {
      throw new Error('Email and new password are required')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Find the user by email
    const { data: { users }, error: listError } = await adminSupabase.auth.admin.listUsers()

    if (listError) {
      throw listError
    }

    const targetUser = users?.find((u: any) => u.email === email)

    if (!targetUser) {
      throw new Error('User not found')
    }

    // Update the user's password
    const { error: updateError } = await adminSupabase.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    )

    if (updateError) {
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password reset successfully',
        email: email
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('Error in reset-password function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
