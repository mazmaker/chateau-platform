# คู่มือการติดตั้งสำหรับทีม (Team Setup Guide)

**อัปเดตล่าสุด**: 29 ธันวาคม 2025
**Branch**: `002-production-readiness`

---

## สำหรับคนที่ 2 (Frontend + Property Management)

### 1. Clone หรือ Update Repository

ถ้ายังไม่ได้ clone:
```bash
git clone https://github.com/mazmaker/chateau-platform.git
cd chateau-platform
```

ถ้ามี repository อยู่แล้ว:
```bash
cd chateau-platform
git checkout 002-production-readiness
git pull origin 002-production-readiness
```

---

### 2. ติดตั้ง Dependencies

```bash
npm install
```

หรือถ้ามีปัญหา:
```bash
rm -rf node_modules package-lock.json
npm install
```

---

### 3. ตั้งค่า Environment Variables

**⚠️ สำคัญ: ไม่ต้องทำอะไรกับ Supabase**

คนที่ 2 **ใช้ Supabase Project เดียวกันกับคนที่ 1** - ไม่ต้อง:
- ❌ สร้าง project ใหม่
- ❌ Run migrations
- ❌ สร้าง tables
- ❌ ตั้งค่า RLS
- ❌ สร้าง storage buckets

**ทุกอย่างพร้อมใน Supabase cloud แล้ว ✅**

เพียงแค่ตรวจสอบว่าไฟล์ `.env` มีค่าถูกต้อง (คนที่ 1 ควรส่งไฟล์นี้ให้):

---

### 4. Start Development Server

```bash
npm run dev
```

เปิด browser ที่: `http://localhost:5173`

---

### 5. เข้าสู่ระบบ (Login)

ใช้บัญชี Owner ของคุณ หรือสร้างบัญชีทดสอบ:

#### สร้างบัญชีทดสอบ (Demo Users)

1. Login ด้วยบัญชี **Owner**
2. ไปที่เมนู **จัดการผู้ใช้**
3. คลิกปุ่ม **"ทดสอบ"** (สีเหลือง-อำพัน)
4. เลือกผู้ใช้ที่ต้องการ หรือคลิก **"สร้างทั้งหมด"**

**รหัสผ่านสำหรับบัญชีทดสอบทั้งหมด**: `Demo123456!`

| อีเมล | ตำแหน่ง | ชื่อ |
|--------|---------|------|
| somchai.demo@example.com | Admin | สมชาย ใจดี |
| wipada.demo@example.com | Sales | วิภาดา รักษ์ดี |
| piti.demo@example.com | Sales | ปิติ มั่งมี |
| napa.demo@example.com | Admin | นภา สุขใจ |
| kitti.demo@example.com | Sales | กิติ เก่งกาจ |

---

## ฟีเจอร์ใหม่ล่าสุด (Latest Features)

### ✅ สิ่งที่คนที่ 1 ทำไปแล้ว:

1. **Settings Page** (หน้าตั้งค่า)
   - อัปโหลดรูปโปรไฟล์
   - เปลี่ยนรหัสผ่าน
   - ตั้งค่า preferences

2. **Avatar Upload System**
   - อัปโหลดรูปโปรไฟล์ได้ (สูงสุด 2MB)
   - ระบบ compress รูปอัตโนมัติ
   - แสดงรูปใน Header, Sidebar, Settings

3. **Demo User Management**
   - สร้างบัญชีทดสอบได้ 5 คน
   - มีเอกสาร `docs/DEMO-USERS.md`

4. **Company Logo System**
   - `CompanyLogo` component พร้อมใช้
   - Company settings API
   - Supabase Storage integration

---

## งานที่คนที่ 2 รับผิดชอบ

### Frontend Development
- Property Management (จัดการโครงการ & ยูนิต)
- Customer Management (จัดการลูกค้า)
- Lead Management (ระบบ Leads)
- UI/UX ทั้งหมด

### หน้าที่ต้องทำ:
1. `/properties` - จัดการโครงการ & ยูนิต
2. `/customers` - จัดการลูกค้า
3. `/leads` - ระบบ Leads

---

## โครงสร้างโปรเจ็กต์ที่สำคัญ

```
chateau-platform/
├── src/
│   ├── components/
│   │   ├── dashboard/        # Header, Sidebar
│   │   ├── company/          # CompanyLogo component
│   │   ├── users/            # UserManagement, DemoUserModal
│   │   └── ui/               # shadcn/ui components
│   ├── contexts/
│   │   └── AuthContextSimple.tsx
│   ├── lib/
│   │   ├── api/              # API functions
│   │   └── supabase.ts
│   └── pages/
│       ├── Settings.tsx      # ✅ คนที่ 1 ทำเสร็จแล้ว
│       ├── PropertyManagement.tsx
│       ├── CustomerManagement.tsx
│       └── LeadManagement.tsx
├── docs/
│   └── DEMO-USERS.md
└── supabase/
    └── migrations/           # ✅ 14 migrations synced
```

---

## Component ที่ใช้ได้เลย

### CompanyLogo Component

```tsx
import { CompanyLogo } from "@/components/company/CompanyLogo";

// ขนาดต่างๆ
<CompanyLogo size="sm" />      // 32px
<CompanyLogo size="md" />      // 48px
<CompanyLogo size="lg" />      // 64px
<CompanyLogo size="xl" />      // 96px
<CompanyLogo size="2xl" />     // 128px
```

### Custom Avatar (ไม่ใช้ shadcn Avatar)

```tsx
// ใช้ pattern นี้แทน Avatar component
<div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-[#676AF1] to-[#38B6FFCC] flex items-center justify-center">
  {userProfile?.avatar_url ? (
    <img src={userProfile.avatar_url} alt={name} className="w-full h-full object-cover" />
  ) : (
    <span className="text-white text-sm font-semibold">
      {initials}
    </span>
  )}
</div>
```

---

## Supabase Migrations Status

| Migration | Description | Status |
|-----------|-------------|--------|
| 20241219000000 | Initial setup | ✅ Synced |
| 20250119020000 | Optimization | ✅ Synced |
| 20250122000000 | RBAC base | ✅ Synced |
| 20250122010000 | User tenants | ✅ Synced |
| 20250122020000 | Properties | ✅ Synced |
| 20250123000000 | Bookings | ✅ Synced |
| 20251226100000 | Company settings | ✅ Synced |
| 20251226100001 | Company logos bucket | ✅ Synced |
| 20251228000000 | User avatars bucket | ✅ Synced |
| ... | ... | ... |

---

## Supabase - ไม่ต้องทำอะไร! ⚠️

**คนที่ 2 ไม่ต้องทำอะไรกับ Supabase เลย** เพราะ:

| อย่าง | สถานะ | คนที่ 2 ต้องทำ? |
|-------|--------|------------------|
| Supabase Project | ✅ พร้อม (ใช้ร่วมกัน) | ❌ |
| Database Tables | ✅ 14 migrations synced | ❌ |
| RLS Policies | ✅ ตั้งค่าแล้ว | ❌ |
| Storage Buckets | ✅ พร้อม (user-avatars, company-logos) | ❌ |
| `.env` file | ✅ คนที่ 1 ส่งให้ | ❌ (แค่รับไฟล์) |

เพียงแค่:
1. รับไฟล์ `.env` จากคนที่ 1
2. วางไว้ที่ root project
3. `npm run dev` เริ่มทำงานได้เลย

---

## ปัญหาที่อาจเจอ

### 1. รูปโปรไฟล์ไม่แสดง
- ตรวจสอบว่า `userProfile.avatar_url` มีค่า
- ตรวจสอบ Supabase Storage bucket permissions

### 2. Login ไม่ได้
- ตรวจสอบ `.env` ว่าถูกต้อง
- ลองสร้างบัญชีใหม่ผ่าน Demo User feature

### 3. Dependencies มีปัญหา
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## การ Commit และ Push

```bash
git add .
git commit -m "feat: your message"
git push origin 002-production-readiness
```

---

## ติดต่อสอบถาม

- GitHub: https://github.com/mazmaker/chateau-platform
- Branch: `002-production-readiness`
- Issues: https://github.com/mazmaker/chateau-platform/issues

---

**Happy Coding! 🚀**
