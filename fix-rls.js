import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listOwnerUsers() {
  console.log('🔍 ตรวจสอบข้อมูล Owner user...\n');

  // ใช้ Supabase Auth Admin API ผ่าน RPC
  const sql = `
    SELECT id, email, role, tenant_id, created_at
    FROM users
    WHERE role = 'owner'
    LIMIT 10;
  `;

  // ลองเรียกใช้ผ่าน RPC function ถ้ามี
  // หรือใช้วิธีอื่น

  console.log('📋 SQL Query:');
  console.log(sql);
  console.log('\n⚠️  ต้องเชื่อมต่อ database โดยตรงเพื่อรันคำสั่งนี้');
  console.log('เพราะ RLS ป้องกันการเข้าถึงผ่าน API');

  console.log('\n--------------------------------------------------');
  console.log('วิธีแก้ปัญหารหัสผ่าน:');
  console.log('--------------------------------------------------');
  console.log('1. ไปที่ Supabase Dashboard: https://supabase.com/dashboard');
  console.log('2. เลือก project: pqnjvcbmnatrtvpqnrdx');
  console.log('3. ไปที่ Authentication -> Users');
  console.log('4. ค้นหา email: mazmakerv2.sup@gmail.com');
  console.log('5. คลิกที่ user แล้วเลือก "Reset Password"');
  console.log('--------------------------------------------------');
}

listOwnerUsers().catch(console.error);
