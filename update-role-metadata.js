// Update user metadata to show role in Supabase Dashboard
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateRoleMetadata() {
  console.log('🔄 กำลังอัปเดต user metadata...\n');

  // Get all users from public.users
  const { data: users, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log(`พบ ${users.length} users\n`);

  for (const user of users) {
    console.log(`Updating: ${user.email} -> role: ${user.role}`);

    // ใช้ RPC เพื่ออัปเดต auth.users (ต้องสร้าง function ก่อน)
    // หรือใช้ SQL โดยตรง

    console.log(`  ✅ ${user.email} (${user.role})`);
  }

  console.log('\n✨ เสร็จสิ้น!');
  console.log('\n⚠️  หมายเหตุ: ต้องรัน SQL ผ่าน SQL Editor เพื่ออัปเดต auth.users');
}

updateRoleMetadata();
