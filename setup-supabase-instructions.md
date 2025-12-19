# Supabase Project Setup Instructions

## 1. หลังจากสร้าง Project สำเร็จ:

ไปที่ Project Settings > API ใน Supabase Dashboard จะได้ข้อมูลนี้:

### Project URL
```
https://[YOUR_PROJECT_ID].supabase.co
```

### API Keys
```
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## 2. อัปเดต .env.local file:

เปิดไฟล์ `.env.local` และอัปเดตข้อมูลจริง:

```env
# Supabase Configuration
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=PASTE_YOUR_ANON_KEY_HERE
```

## 3. สร้าง Supabase Project:

1. เปิด: https://supabase.com/dashboard
2. คลิก "New Project"
3. ชื่อ project: `chateau-platform`
4. Password: เลือก password ที่จำง่าย (จดไว้)
5. Region: Southeast Asia (Singapore)
6. คลิก "Create new project"

## 4. ถ้ามี project เดิม:

1. คลิก "New Project"
2. เลือก "Start from scratch"
3. ชื่อ: `chateau-platform-production`
4. ใช้ database เดิมถ้าต้องการ