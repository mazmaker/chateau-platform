-- Fix RLS Policy สำหรับการตั้งค่าขั้นสูง
-- รันใน Supabase SQL Editor

-- เพิ่มคอลัมน์สำหรับเก็บ billing settings ใน profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS billing_settings jsonb DEFAULT '{}';

-- 1. เพิ่ม Policy ให้ user สามารถอ่าน profile ของตัวเองได้
CREATE POLICY "Users can read their own profile" ON profiles
FOR SELECT USING (user_id = auth.uid());

-- 2. เพิ่ม Policy ให้ user สามารถอ่าน company_settings ของ tenant ตัวเองได้
CREATE POLICY "Users can read their tenant company settings" ON company_settings
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 3. เพิ่ม Policy ให้ user สามารถแก้ไข company_settings ของ tenant ตัวเองได้
CREATE POLICY "Users can update their tenant company settings" ON company_settings
FOR UPDATE USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 4. เพิ่ม Policy ให้ user สามารถสร้าง company_settings ใหม่ได้ (กรณียังไม่มี)
CREATE POLICY "Users can insert their tenant company settings" ON company_settings
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- 5. ตรวจสอบ policies ที่มี
SELECT
    schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('profiles', 'company_settings')
ORDER BY tablename, policyname;