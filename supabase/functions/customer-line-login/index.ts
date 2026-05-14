// Edge Function: Customer LINE Login
//
// Flow:
//   1. Frontend opens LINE OAuth URL → user authorizes on LINE
//   2. LINE redirects to /customer/line-callback?code=...
//   3. Callback page POSTs the code here
//   4. We exchange code → access_token (using LINE_CHANNEL_ID + LINE_CHANNEL_SECRET)
//   5. Fetch profile from LINE → get userId + display name + picture
//   6. Find/create customer by line_user_id
//   7. Create Supabase auth session (synthetic email tied to LINE userId)
//   8. Return session tokens to frontend
//
// Required Supabase Edge Function secrets:
//   - LINE_CHANNEL_ID
//   - LINE_CHANNEL_SECRET
//   - LINE_CALLBACK_URL (e.g. http://localhost:5173/customer/line-callback)

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
    const channelId = Deno.env.get('LINE_CHANNEL_ID')
    const channelSecret = Deno.env.get('LINE_CHANNEL_SECRET')
    const callbackUrl = Deno.env.get('LINE_CALLBACK_URL')

    if (!channelId || !channelSecret || !callbackUrl) {
      throw new Error('ระบบ LINE Login ยังไม่ได้ตั้งค่า — กรุณาติดต่อผู้ดูแลระบบ')
    }

    const { code } = await req.json()
    if (!code) throw new Error('ไม่พบ authorization code จาก LINE')

    // 1. Exchange code → access_token + id_token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl,
        client_id: channelId,
        client_secret: channelSecret,
      }),
    })
    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok) {
      console.error('LINE token exchange failed:', tokenJson)
      throw new Error('แลก token จาก LINE ไม่สำเร็จ: ' + (tokenJson.error_description || tokenJson.error || 'unknown'))
    }
    const lineAccessToken = tokenJson.access_token as string

    // 2. Fetch profile from LINE
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${lineAccessToken}` },
    })
    const profile = await profileRes.json()
    if (!profileRes.ok || !profile.userId) {
      throw new Error('ไม่สามารถดึงข้อมูล LINE profile ได้')
    }

    const lineUserId = profile.userId as string
    const displayName = profile.displayName as string | undefined

    // 3. Find existing customer by line_user_id
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing } = await (admin.from('customers') as any)
      .select('id, full_name, email, tenant_id, auth_user_id, line_user_id')
      .eq('line_user_id', lineUserId)
      .maybeSingle()
    let customer: any = existing

    // Synthetic email so Supabase Auth has something to anchor on
    const syntheticEmail = `customer+line_${lineUserId}@chateau.local`
    let authUserId: string | null = customer?.auth_user_id || null

    // 4. Create or get auth user
    if (!authUserId) {
      const tempPassword = crypto.randomUUID() + crypto.randomUUID().slice(0, 16)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: syntheticEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { role: 'customer', line_user_id: lineUserId, full_name: displayName || customer?.full_name || null },
      })
      if (createErr) {
        // Already exists — find by email
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: list } = await (admin.auth.admin as any).listUsers({ page: 1, perPage: 200 })
        const found = list?.users?.find((u: any) => u.email === syntheticEmail)
        if (!found) throw new Error('ไม่สามารถสร้างบัญชี LINE ได้: ' + createErr.message)
        authUserId = found.id
      } else {
        authUserId = created.user.id
      }
    }

    // 5. Link or create customer record
    if (customer) {
      const updates: Record<string, unknown> = {}
      if (!customer.auth_user_id) updates.auth_user_id = authUserId
      if (displayName && !customer.full_name) updates.full_name = displayName
      if (Object.keys(updates).length > 0) {
        await admin.from('customers').update(updates).eq('id', customer.id)
      }
    } else {
      const { data: newCustomer } = await admin.from('customers').insert({
        full_name: displayName || 'ลูกค้าใหม่จาก LINE',
        line_user_id: lineUserId,
        auth_user_id: authUserId,
        acquisition_source: 'line',
        is_active: true,
      }).select().single()
      customer = newCustomer
    }

    // 6. Generate Supabase session by signing in with the synthetic email
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
      isNew: !existing,
      customer_id: customer?.id || null,
      full_name: customer?.full_name || displayName || null,
      line_user_id: lineUserId,
      access_token: signed.session.access_token,
      refresh_token: signed.session.refresh_token,
      expires_in: signed.session.expires_in,
      user_id: authUserId,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('customer-line-login error:', error)
    return new Response(JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
