-- ลบ RLS Policies ที่ซ้ำซ้อนแล้วสร้างใหม่
-- รันใน Supabase SQL Editor

-- 1. ลบ policies เก่าที่ซ้ำกัน
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Users can read their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;

-- 2. สร้าง policy ใหม่ที่ชัดเจน
CREATE POLICY "User profile access" ON profiles
FOR ALL USING (user_id = auth.uid());

-- 3. ตรวจสอบ policies ที่เหลือ
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;