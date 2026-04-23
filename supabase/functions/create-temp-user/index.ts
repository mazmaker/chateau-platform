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

    const { email, fullName, role, userId } = await req.json()

    if (!email || !fullName) {
      throw new Error('Missing required fields: email, fullName')
    }

    // Generate temporary password
    const tempPassword = generateTempPassword()

    console.log(`Creating user: ${email} with role: ${role}`)

    // Check if auth user already exists
    const { data: existingUser } = await supabaseAdmin.auth.admin.getUserById(userId)

    if (existingUser?.user) {
      // User exists in auth, just update password
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: tempPassword
      })

      if (updateError) {
        console.error('Error updating user:', updateError)
        throw updateError
      }
    } else {
      // Create new auth user
      const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          role: role
        }
      })

      if (authError) {
        console.error('Error creating auth user:', authError)
        throw authError
      }

      console.log(`Auth user created: ${authUser.user?.id}`)
    }

    // Update users table to mark as temporary password
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

    console.log(`✅ Successfully created/updated user: ${email}`)

    return new Response(
      JSON.stringify({
        success: true,
        tempPassword: tempPassword,
        message: 'User created successfully'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('Error in create-temp-user function:', error)

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