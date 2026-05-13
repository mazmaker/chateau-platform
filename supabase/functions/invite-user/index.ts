// Edge Function: Invite User (v4)
// Flow: Create auth.users FIRST → trigger creates public.users → update with invite details
// This guarantees public.users.id = auth.users.id from the start.

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
      throw new Error('ไม่พบข้อมูลการยืนยันตัวตน')
    }

    const { email, fullName, tenantId, role, redirectTo } = await req.json()
    if (!email || !fullName || !tenantId || !role) {
      throw new Error('กรุณากรอกข้อมูลให้ครบถ้วน: อีเมล, ชื่อ, บริษัท, ตำแหน่ง')
    }

    const normalizedEmail = email.toLowerCase().trim()
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Validate caller's JWT
    const jwt = authHeader.replace('Bearer ', '')
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await userSupabase.auth.getUser(jwt)
    if (userError || !user) {
      throw new Error('ไม่มีสิทธิ์เข้าถึง กรุณาเข้าสู่ระบบใหม่')
    }

    // Admin client (service role — bypasses RLS)
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Look up inviter in public.users
    const { data: inviter, error: inviterError } = await admin
      .from('users')
      .select('id, role, tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    if (inviterError || !inviter) {
      throw new Error('ไม่พบข้อมูลผู้ใช้ในระบบ')
    }

    // Permission check
    if (inviter.role !== 'owner' && inviter.tenant_id !== tenantId) {
      throw new Error('ไม่มีสิทธิ์: แอดมินสามารถเพิ่มผู้ใช้ได้เฉพาะในบริษัทของตัวเองเท่านั้น')
    }
    if (inviter.role === 'admin' && !['sales', 'agent'].includes(role)) {
      throw new Error('แอดมินสามารถเพิ่มได้เฉพาะพนักงานขายและนายหน้าเท่านั้น')
    }

    // Check if email already exists (active user OR pending invite still valid)
    const { data: existingPublic } = await admin
      .from('users')
      .select('id, is_active, signup_token, signup_expires_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (existingPublic) {
      if (existingPublic.is_active) {
        throw new Error('อีเมลนี้มีในระบบแล้ว')
      }
      // Pending invite — resend if not expired
      if (existingPublic.signup_token && existingPublic.signup_expires_at &&
          new Date(existingPublic.signup_expires_at) > new Date()) {
        const baseUrl = redirectTo || `${new URL(req.url).origin}/auth/accept-invite`
        return new Response(JSON.stringify({
          success: true,
          user_id: existingPublic.id,
          email: normalizedEmail,
          invite_url: `${baseUrl}?token=${existingPublic.signup_token}`,
          message: 'ส่งคำเชิญซ้ำ (คำเชิญเดิมยังไม่หมดอายุ)',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      // Expired pending invite — clean up first
      await admin.auth.admin.deleteUser(existingPublic.id).catch(() => {})
      await admin.from('users').delete().eq('id', existingPublic.id)
    }

    // STEP 1: Create auth.users FIRST (trigger will create basic public.users row)
    const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 16)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        tenant_id: tenantId,
        role: role,
        invited_by: user.id,
      },
    })

    if (authError || !authData?.user) {
      const msg = authError?.message || ''
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('registered')) {
        throw new Error('อีเมลนี้ถูกลงทะเบียนในระบบแล้ว')
      }
      throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ได้')
    }

    const newUserId = authData.user.id
    const signupToken = (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, '')
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

    // STEP 2: Upsert public.users row with invite details
    // (handle_new_user trigger may or may not have auto-created a basic row — upsert handles both)
    const { error: updateError } = await admin
      .from('users')
      .upsert({
        id: newUserId,
        email: normalizedEmail,
        full_name: fullName,
        tenant_id: tenantId,
        role: role,
        is_active: false,
        signup_token: signupToken,
        signup_expires_at: expiresAt,
        invite_token: signupToken,
        invited_by: inviter.id,
        invited_at: new Date().toISOString(),
        auth_user_id: newUserId,
      }, { onConflict: 'id' })

    if (updateError) {
      // Rollback auth user
      await admin.auth.admin.deleteUser(newUserId).catch(() => {})
      throw new Error('ไม่สามารถบันทึกข้อมูลผู้ใช้ได้')
    }

    // Log activity (best-effort)
    try {
      await admin.rpc('log_activity', {
        p_tenant_id: tenantId,
        p_user_id: newUserId,
        p_activity_type: 'user_invited',
        p_description: `User invited: ${fullName} (${normalizedEmail})`,
        p_metadata: { email: normalizedEmail, role, invited_by: inviter.id },
      })
    } catch (_e) { /* ignore logging errors */ }

    const baseUrl = redirectTo || `${new URL(req.url).origin}/auth/accept-invite`
    return new Response(JSON.stringify({
      success: true,
      user_id: newUserId,
      email: normalizedEmail,
      auth_user_id: newUserId,
      invite_url: `${baseUrl}?token=${signupToken}`,
      message: 'ส่งคำเชิญสำเร็จ',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('Error in invite-user function:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
