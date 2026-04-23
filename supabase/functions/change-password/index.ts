import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
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
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create regular client to update user password
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get user session from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')

    // Set session for client
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)

    if (userError || !user) {
      throw new Error('Invalid session')
    }

    const { newPassword } = await req.json()

    if (!newPassword) {
      throw new Error('New password is required')
    }

    console.log(`Changing password for user: ${user.id} (${user.email})`)

    // Update password using admin client
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    })

    if (passwordError) {
      console.error('Error updating password:', passwordError)
      throw passwordError
    }

    console.log('✅ Password updated in Auth')

    // Mark as permanent password in users table using admin client
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({
        password_set_at: new Date().toISOString(),
        first_login_at: new Date().toISOString()
      })
      .eq('id', user.id)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      throw profileError
    }

    console.log('✅ Profile updated with permanent password status')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Password changed successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Error in change-password function:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})