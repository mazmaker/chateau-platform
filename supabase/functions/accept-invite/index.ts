// Edge Function: Accept Invite (v2)
// User submits signup_token + chosen password.
// Since invite-user v4 guarantees public.users.id = auth.users.id, we use admin client to
// safely update the password for THAT specific user only (no overwrite risk).

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
      throw new Error('ข้อมูลไม่ครบ (ต้องมี token และรหัสผ่าน)')
    }
    if (password.length < 6) {
      throw new Error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Find pending user by signup_token OR invite_token (using admin = bypass RLS)
    const { data: pendingUser, error: findError } = await admin
      .from('users')
      .select('id, email, full_name, role, tenant_id, is_active, signup_token, signup_expires_at, invite_token')
      .or(`invite_token.eq.${inviteToken},signup_token.eq.${inviteToken}`)
      .maybeSingle()

    if (findError || !pendingUser) {
      throw new Error('ลิงก์เชิญไม่ถูกต้องหรือถูกใช้ไปแล้ว')
    }
    if (pendingUser.is_active) {
      throw new Error('คำเชิญนี้ถูกใช้ไปแล้ว กรุณาเข้าสู่ระบบ')
    }
    if (pendingUser.signup_expires_at && new Date(pendingUser.signup_expires_at) < new Date()) {
      throw new Error('ลิงก์เชิญหมดอายุแล้ว กรุณาขอคำเชิญใหม่')
    }

    // SAFETY GUARD: Verify the auth.users row actually exists with matching email
    // before updating password — prevents password overwrite of unrelated user.
    const { data: { user: authUser }, error: authLookupError } = await admin.auth.admin.getUserById(pendingUser.id)
    if (authLookupError || !authUser) {
      throw new Error('ไม่พบบัญชีผู้ใช้ในระบบ Auth — กรุณาขอคำเชิญใหม่')
    }
    if (authUser.email?.toLowerCase() !== pendingUser.email.toLowerCase()) {
      console.error('[SECURITY] Email mismatch:', { authEmail: authUser.email, pendingEmail: pendingUser.email })
      throw new Error('ข้อมูลผู้ใช้ไม่ตรงกัน กรุณาติดต่อผู้ดูแลระบบ')
    }

    // Update password
    const { error: updateAuthError } = await admin.auth.admin.updateUserById(
      pendingUser.id,
      { password, email_confirm: true }
    )
    if (updateAuthError) {
      throw new Error(`ไม่สามารถตั้งรหัสผ่านได้: ${updateAuthError.message}`)
    }

    // Activate the user and clear tokens
    const { error: activateError } = await admin
      .from('users')
      .update({
        is_active: true,
        password_set_at: new Date().toISOString(),
        signup_token: null,
        invite_token: null,
        invite_accepted_at: new Date().toISOString(),
      })
      .eq('id', pendingUser.id)

    if (activateError) {
      console.error('Failed to activate user:', activateError)
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: pendingUser.id,
      email: pendingUser.email,
      message: 'ตั้งรหัสผ่านสำเร็จ',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error in accept-invite function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
