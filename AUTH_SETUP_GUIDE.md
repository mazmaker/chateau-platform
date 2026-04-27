# CHATEAU Platform - ระบบล็อกอินด้วย Supabase
## คู่มือการติดตั้งและใช้งาน

---

## สรุปสิ่งที่สร้างเสร็จแล้ว

### 1. ฐานข้อมูล (Database Schema)
ไฟล์: `supabase/migrations/auth_setup.sql`

ตารางที่สร้าง:
- **tenants** - เก็บข้อมูลองค์กร/บริษัท
- **users** - เก็บข้อมูลผู้ใช้ (เชื่อมกับ auth.users)
- **user_tenants** - เก็บความสัมพันธ์ระหว่างผู้ใช้และองค์กร พร้อมสิทธิ์ (role)

สิทธิ์การใช้งาน (Roles):
- **owner** - เจ้าของ (เข้าถึงได้ทั้งหมด)
- **admin** - ผู้ดูแลระบบ
- **sales** - พนักงานขาย
- **viewer** - ผู้ชมเท่านั้น

### 2. Authentication Context
ไฟล์: `src/contexts/AuthContextSimple.tsx`

ฟังก์ชันที่มี:
- `signIn(email, password)` - เข้าสู่ระบบ
- `signUp(email, password, fullName)` - ลงทะเบียน
- `signOut()` - ออกจากระบบ
- `resetPassword(email)` - รีเซ็ตรหัสผ่าน
- `switchTenant(tenantId)` - เปลี่ยนองค์กร
- `refreshUser()` - รีเฟรชข้อมูลผู้ใช้

### 3. Login Form
ไฟล์: `src/components/auth/LoginFormSimple.tsx`

ฟีเจอร์:
- ฟอร์มล็อกอินสวยงาม
- แสดง/ซ่อนรหัสผ่าน
- จดจำผู้ใช้
- ข้อความ error เป็นภาษาไทย
- รองรับ loading state

### 4. Protected Routes
ไฟล์: `src/components/auth/ProtectedRouteSimple.tsx`

ฟีเจอร์:
- ป้องกันการเข้าถึงหน้าโดยไม่ล็อกอิน
- ตรวจสอบสิทธิ์ (role-based access)
- Redirect อัตโนมัติ

---

## ขั้นตอนการติดตั้ง

### Step 1: รัน SQL Database Schema

1. ไปที่: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
2. คัดลอก SQL จากไฟล์ `supabase/migrations/auth_setup.sql`
3. วางแล้วกด "RUN"
4. รอสักครู่ (30-60 วินาที)

### Step 2: สร้างผู้ใช้ทดสอบ

มี 2 วิธี:

#### วิธี A: ใช้ Supabase Dashboard (ง่ายที่สุด)

1. ไปที่: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/auth/users
2. กด "Add user" หรือ "New user"
3. ใส่อีเมล: `test@example.com`
4. ใส่รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)
5. กด "Auto Confirm User" เพื่อไม่ต้องยืนยันอีเมล
6. กด "Create user"

จากนั้นรัน SQL นี้เพื่อสร้าง tenant ให้ user:

```sql
SELECT create_tenant_with_owner(
    'Test Tenant',
    'test@example.com',
    'Test User'
);
```

#### วิธี B: สมัครผ่านหน้าเว็บ (ระบบจะสร้าง tenant อัตโนมัติ)

1. เปิด: http://localhost:5174/auth/login
2. รอสักครู่เพราะระบบ signup ยังไม่สมบูรณ์

### Step 3: ทดสอบระบบ

1. รัน dev server:
```bash
npm run dev
```

2. เปิดเบราว์เซอร์ไปที่: http://localhost:5174/auth/login

3. ล็อกอินด้วย:
   - อีเมล: `test@example.com`
   - รหัสผ่าน: (ที่คุณตั้งไว้)

4. ถ้าสำเร็จ จะ redirect ไปที่ Dashboard อัตโนมัติ

---

## โครงสร้างไฟล์ที่สำคัญ

```
src/
├── contexts/
│   └── AuthContextSimple.tsx          # Authentication Context
├── components/
│   └── auth/
│       ├── LoginFormSimple.tsx         # Login Form Component
│       └── ProtectedRouteSimple.tsx    # Protected Route Wrapper
├── pages/
│   └── SimpleLogin.tsx                 # Login Page
└── lib/
    └── supabase.ts                     # Supabase Client
```

---

## วิธีใช้งานใน Code

### ตรวจสอบสถานะล็อกอิน

```tsx
import { useSimpleAuth } from '@/contexts/AuthContextSimple'

function MyComponent() {
  const { user, userRole, loading } = useSimpleAuth()

  if (loading) return <div>กำลังโหลด...</div>

  if (!user) return <div>กรุณาล็อกอิน</div>

  return (
    <div>
      <p>สวัสดี {user.email}</p>
      <p>สิทธิ์: {userRole}</p>
    </div>
  )
}
```

### ป้องกันหน้าด้วย Role

```tsx
import { ProtectedRouteSimple } from '@/components/auth/ProtectedRouteSimple'

function OwnerOnlyPage() {
  return (
    <ProtectedRouteSimple requireRole="owner">
      <div>หน้านี้เฉพาะ Owner เท่านั้น</div>
    </ProtectedRouteSimple>
  )
}
```

### ตรวจสอบสิทธิ์

```tsx
import { useRequireRole, useRequireAnyRole } from '@/components/auth/ProtectedRouteSimple'

function MyComponent() {
  const isOwner = useRequireRole('owner')
  const canManage = useRequireAnyRole(['owner', 'admin'])

  return (
    <div>
      {isOwner && <button>ลบข้อมูล</button>}
      {canManage && <button>แก้ไข</button>}
    </div>
  )
}
```

### ล็อกเอาท์

```tsx
import { useSimpleAuth } from '@/contexts/AuthContextSimple'

function LogoutButton() {
  const { signOut } = useSimpleAuth()

  return (
    <button onClick={signOut}>ออกจากระบบ</button>
  )
}
```

---

## การตั้งค่า Supabase

ตรวจสอบไฟล์ `.env.local`:

```env
VITE_SUPABASE_URL=https://pqnjvcbmnatrtvpqnrdx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Troubleshooting

### ปัญหา: ล็อกอินไม่ได้

1. ตรวจสอบว่ารัน SQL schema แล้ว
2. ตรวจสอบว่า user ถูกสร้างใน Supabase
3. เปิด Console ในเบราว์เซอร์ดู error

### ปัญหา: ไม่มีสิทธิ์ Owner

ตรวจสอบใน Supabase SQL Editor:

```sql
-- ตรวจสอบ user และ role
SELECT
    u.email,
    ut.role,
    t.name as tenant_name
FROM users u
JOIN user_tenants ut ON u.id = ut.user_id
JOIN tenants t ON ut.tenant_id = t.id
WHERE u.email = 'test@example.com';
```

ถ้าไม่มีข้อมูล รัน:

```sql
SELECT create_tenant_with_owner('Test Tenant', 'test@example.com', 'Test User');
```

---

## ตำแหน่งไฟล์สำคัญ

| ไฟล์ | คำอธิบาย |
|------|----------|
| `supabase/migrations/auth_setup.sql` | Database Schema |
| `src/contexts/AuthContextSimple.tsx` | Auth Context |
| `src/components/auth/LoginFormSimple.tsx` | Login Form |
| `src/components/auth/ProtectedRouteSimple.tsx` | Protected Routes |
| `src/pages/SimpleLogin.tsx` | Login Page |
| `src/App.tsx` | App Routes |

---

## ถัดไป

หลังจากล็อกอินสำเร็จ:
1. ระบบจะ redirect ไปหน้า Dashboard (`/`)
2. ข้อมูล tenant และ role จะถูกเก็บไว้ใน Context
3. สามารถเข้าถึงข้อมูลผ่าน `useSimpleAuth()` ได้ทั่วทั้ง app

---

**ติดต่อ / ข้อสงสัย:**
- ตรวจสอบ Console ในเบราว์เซอร์
- ตรวจสอบ Supabase Dashboard
- ดู logs ใน Network tab