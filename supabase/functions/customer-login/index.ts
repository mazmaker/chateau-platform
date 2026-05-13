// Edge Function: Customer Login (Test Mode — no OTP)
// In dev/staging, customer enters phone → instant login (no SMS).
// For production, replace this with Supabase phone OTP flow.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const normalizePhone = (p: string): string => {
  const digits = p.replace(/\D/g, '')
  if (/^0\d{9}$/.test(digits)) return digits
  if (/^66\d{9}$/.test(digits)) return '0' + digits.slice(2)
  return digits
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone } = await req.json()
    if (!phone) throw new Error('กรุณากรอกเบอร์โทร')

    const normalized = normalizePhone(phone)
    if (!/^0\d{9}$/.test(normalized)) {
      throw new Error('เบอร์โทรไม่ถูกต้อง — กรุณากรอก 10 หลัก ขึ้นต้นด้วย 0')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 1. Find existing customer by phone (loose match — strip dashes for comparison)
    const { data: matches } = await admin
      .from('customers')
      .select('id, full_name, email, tenant_id, auth_user_id, preferences')
      .or(`phone.eq.${normalized},phone.eq.${phone}`)
      .order('created_at', { ascending: false })
      .limit(1)
    let customer: any = matches?.[0] || null

    // Use a synthetic email tied to phone for auth (Supabase Auth needs email or phone)
    const syntheticEmail = `customer+${normalized}@chateau.local`

    let authUserId: string | null = customer?.auth_user_id || null

    // 2. Create or get auth user (using admin API)
    if (!authUserId) {
      // Try create new auth user
      const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 16)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: tempPassword,
        email_confirm: true,
        phone: undefined,
        user_metadata: { role: 'customer', phone: normalized, full_name: customer?.full_name || null },
      })
      if (createErr) {
        // If already exists, fetch by email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: list } = await (admin.auth.admin as any).listUsers({ page: 1, perPage: 200 })
        const existing = list?.users?.find((u: any) => u.email === syntheticEmail)
        if (!existing) throw new Error('ไม่สามารถสร้างบัญชีผู้ใช้ได้: ' + createErr.message)
        authUserId = existing.id
      } else {
        authUserId = created.user.id
      }
    }

    // 3. Link or create customer record
    if (customer) {
      if (!customer.auth_user_id) {
        await admin.from('customers').update({ auth_user_id: authUserId }).eq('id', customer.id)
      }
    } else {
      // No existing customer — create blank one (no tenant; tenant assigned when they express interest)
      const { data: newCustomer, error: insErr } = await admin.from('customers').insert({
        full_name: 'ลูกค้าใหม่',
        phone: normalized,
        auth_user_id: authUserId,
        is_active: true,
        // tenant_id is required NOT NULL? — fallback to a default tenant or null
      }).select().single()
      if (insErr) {
        console.error('Create customer error:', insErr)
        // Continue anyway — user can complete profile after login
      } else {
        customer = newCustomer
      }
    }

    // 4. Generate a fresh session by signing in with the synthetic email
    // We need to set a known password and sign in to get a session token
    const sessionPassword = crypto.randomUUID()
    await admin.auth.admin.updateUserById(authUserId!, { password: sessionPassword })

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anonClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: signed, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: syntheticEmail,
      password: sessionPassword,
    })
    if (signInErr || !signed?.session) {
      throw new Error('สร้าง session ไม่สำเร็จ: ' + (signInErr?.message || 'unknown'))
    }

    return new Response(JSON.stringify({
      success: true,
      isNew: !customer,
      customer_id: customer?.id || null,
      full_name: customer?.full_name || null,
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      expires_in: signed.session.expires_in,
      user_id: authUserId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('customer-login error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
