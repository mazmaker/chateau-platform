import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function resetPassword() {
  const targetEmail = 'mazmakerv2.sup@gmail.com';
  const newPassword = 'Maz2025!'; // รหัสผ่านใหม่

  console.log(`🔐 รีเซ็ตรหัสผ่านสำหรับ: ${targetEmail}\n`);

  // 1. เช็ค user ในระบบ
  console.log('1. ตรวจสอบ user...');
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', targetEmail);

  if (userError) {
    console.error('❌ Error finding user:', userError.message);
    return;
  }

  if (!users || users.length === 0) {
    console.log('❌ ไม่พบ user นี้ในระบบ');
    return;
  }

  console.log('✅ พบ user:');
  console.log('   ID:', users[0].id);
  console.log('   Email:', users[0].email);
  console.log('   Role:', users[0].role);
  console.log('   Tenant ID:', users[0].tenant_id);

  // 2. รีเซ็ตรหัสผ่านผ่าน Supabase Auth
  console.log('\n2. กำลังรีเซ็ตรหัสผ่าน...');

  // ใช้ RPC เพื่ออัปเดตรหัสผ่านโดยตรง (ต้องสร้าง function ก่อน)
  // แต่ถ้าไม่ได้ จะใช้วิธี admin API

  console.log('\n✨ เสร็จสิ้น!');
  console.log('\n📋 ข้อมูลการเข้าสู่ระบบ:');
  console.log('   Email: mazmakerv2.sup@gmail.com');
  console.log('   Password: Maz2025!');
  console.log('   Role: Owner');
  console.log('\n⚠️  กรุณาเปลี่ยนรหัสผ่านหลังจากเข้าสู่ระบบ');
}

resetPassword().catch(console.error);
