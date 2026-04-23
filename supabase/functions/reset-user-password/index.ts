import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function generateTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const length = 8
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return `Temp${result}!`
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

    const { userId, email } = await req.json()

    if (!userId || !email) {
      throw new Error('Missing required fields: userId, email')
    }

    // Generate new temporary password
    const tempPassword = generateTempPassword()

    console.log(`Resetting password for user: ${userId} (${email})`)

    // Update password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: tempPassword
    })

    if (updateError) {
      console.error('Error updating password:', updateError)
      throw updateError
    }

    // Mark as temporary password in users table
    const { error: profileError } = await supabaseAdmin
      .from('users')
      .update({
        password_set_at: null
      })
      .eq('id', userId)

    if (profileError) {
      console.error('Error updating profile:', profileError)
      throw profileError
    }

    console.log(`✅ Successfully reset password for user: ${email}`)

    return new Response(
      JSON.stringify({
        success: true,
        tempPassword: tempPassword,
        message: 'Password reset successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in reset-user-password function:', error)

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