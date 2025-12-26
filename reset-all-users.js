// ============================================
// RESET ALL USERS - Delete and Create New Users
// ============================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
// Use service role key for admin operations
const serviceRoleKey = 'YOUR_SERVICE_ROLE_KEY'; // ต้องดูจาก Supabase Dashboard

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Users to create
const usersToCreate = [
  {
    email: 'owner@chateau.com',
    password: 'Chateau2025!',
    role: 'owner',
    emailConfirm: true
  },
  {
    email: 'admin@chateau.com',
    password: 'Chateau2025!',
    role: 'admin',
    tenant_id: null, // จะถูกสร้างอัตโนมัติ
    emailConfirm: true
  },
  {
    email: 'sales@chateau.com',
    password: 'Chateau2025!',
    role: 'sales',
    tenant_id: null,
    emailConfirm: true
  }
];

async function resetAllUsers() {
  console.log('🔄 เริ่มต้นการลบและสร้าง User ใหม่...\n');

  try {
    // Step 1: Delete all users from public.users table
    console.log('1️⃣  ลบข้อมูล User จาก public.users...');

    const { error: deleteError } = await supabase
      .from('users')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (deleteError) {
      console.log('⚠️  Warning:', deleteError.message);
    } else {
      console.log('✅ ลบข้อมูลจาก public.users เรียบร้อย');
    }

    // Step 2: Delete from auth.users (needs service role)
    console.log('\n2️⃣  ลบ User จาก auth.users...');
    console.log('⚠️  ต้องใช้ SQL Editor ใน Supabase Dashboard เพื่อลบ auth.users');

    // Step 3: Create new users
    console.log('\n3️⃣  สร้าง User ใหม่...');

    for (const userData of usersToCreate) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          role: userData.role
        }
      });

      if (error) {
        console.log(`❌ สร้าง ${userData.email} ไม่สำเร็จ:`, error.message);
      } else {
        console.log(`✅ สร้าง ${userData.email} สำเร็จ (ID: ${data.user.id})`);

        // Add to public.users table
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: userData.email,
            role: userData.role,
            tenant_id: userData.tenant_id || 'default-tenant-id'
          });

        if (insertError) {
          console.log(`   ⚠️  ไม่สามารถเพิ่มลง public.users:`, insertError.message);
        }
      }
    }

    console.log('\n✨ เสร็จสิ้น!');
    console.log('\n📋 ข้อมูล User ใหม่:');
    usersToCreate.forEach(u => {
      console.log(`   ${u.email} / ${u.password} (${u.role})`);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Instructions
console.log(`
========================================
วิธีลบและสร้าง User ใหม่
========================================

Option 1: ผ่าน SQL Editor (ง่ายที่สุด)
--------------------------------------------------
1. ไปที่ https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx
2. เลือก SQL Editor
3. รันคำสั่งนี้:

-- ลบข้อมูลจาก public.users
DELETE FROM public.users;

-- ลบข้อมูลจาก auth.users
DELETE FROM auth.users WHERE email NOT LIKE '%@supabase%';

-- สร้าง User ใหม่ (ใช้ Supabase Admin API)
-- หรือสร้างผ่าน Dashboard: Authentication -> Users -> Add User

Option 2: ใช้ Script นี้
--------------------------------------------------
1. ไปที่ Supabase Dashboard
2. Project Settings -> API
3. Copy "service_role" key (จะมี secret เป็น *** คลิกเพื่อแสดง)
4. ใส่ใน script แล้วรัน: node reset-all-users.js

========================================
รายการ User ที่จะสร้าง
========================================
`);

usersToCreate.forEach(u => {
  console.log(`Email: ${u.email}`);
  console.log(`Password: ${u.password}`);
  console.log(`Role: ${u.role}`);
  console.log('---');
});

console.log(`
========================================
`);
