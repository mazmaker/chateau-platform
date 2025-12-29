# คู่มือการติดตั้งสำหรับทีม (Team Setup Guide)

**อัปเดตล่าสุด**: 29 ธันวาคม 2025

---

## สำหรับคนที่ 2 (Frontend + Property Management)

### Branch Strategy
- **คนที่ 1**: ทำงานใน `002-production-readiness` (Backend + Settings)
- **คนที่ 2**: ทำงานใน `feature/multi-role` (Frontend + Property)

---

## ขั้นตอนการเริ่มต้น

### Step 1: Clone Repository (ถ้ายังไม่ได้ clone)

```bash
git clone https://github.com/mazmaker/chateau-platform.git
cd chateau-platform
```

---

### Step 2: Pull งานล่าสุดจากคนที่ 1

```bash
git pull origin 002-production-readiness
```

**สิ่งที่จะได้รับ:**
- Settings Page (Profile, Security, Preferences)
- Avatar Upload System
- Demo User Management
- Company Logo System
- 14 Supabase migrations (synced แล้ว)
- UI components ทั้งหมด

---

### Step 3: สลับไป Branch ของตัวเอง

```bash
git checkout feature/multi-role
```

**ถ้ายังไม่มี branch นี้:**

```bash
git checkout -b feature/multi-role
```

---

### Step 4: อัปเดต Branch ของตัวเองให้เท่ากับงานล่าสุด

```bash
# รวมงานจาก 002-production-readiness เข้า feature/multi-role
git merge 002-production-readiness
```

---

### Step 5: Install Dependencies

```bash
npm install
```

หรือถ้ามีปัญหา:

```bash
rm -rf node_modules package-lock.json
npm install
```

---

### Step 6: ตั้งค่า Environment Variables

**⚠️ สำคัญ: ใช้ Supabase Project เดียวกันกับคนที่ 1**

รับไฟล์ `.env` จากคนที่ 1 แล้ววางไว้ที่ root project

```env
VITE_SUPABASE_URL=https://pqnjvcbmnatrtvpqnrdx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**ไม่ต้อง:**
- ❌ สร้าง Supabase project ใหม่
- ❌ Run migrations
- ❌ สร้าง tables
- ❌ ตั้งค่า RLS

**ทุกอย่างพร้อมใน Supabase cloud แล้ว ✅**

---

### Step 7: เริ่มทำงาน

```bash
npm run dev
```

เปิด browser: `http://localhost:5173`

---

## การ Login ทดสอบ

### สร้างบัญชีทดสอบ (Demo Users)

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

## ฟีเจอร์ใหม่ล่าสุด (จากคนที่ 1)

### ✅ พร้อมใช้งานแล้ว:

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

## การเช็คสถานะ Branch

```bash
# เช็ค branch ปัจจุบัน
git branch --show-current

# ดูทุก branch
git branch

# ดูสถานะ
git status
```

คุณควรอยู่ใน: `feature/multi-role`

---

## การ Commit และ Push

```bash
# เช็คสถานะ
git status

# Add ไฟล์ที่แก้ไข
git add .

# Commit
git commit -m "feat: your message"

# Push ไป branch ของคุณ
git push origin feature/multi-role
```

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

## สรุปแบบสั้นๆ

```bash
# 1. Pull งานล่าสุด
git pull origin 002-production-readiness

# 2. สลับไป branch ของตัวเอง
git checkout feature/multi-role

# 3. รวมงานล่าสุดเข้า branch ตัวเอง
git merge 002-production-readiness

# 4. Install dependencies
npm install

# 5. รับไฟล์ .env จากคนที่ 1

# 6. เริ่มทำงาน
npm run dev
```

---

**Happy Coding! 🚀**

---

## ติดต่อสอบถาม

- GitHub: https://github.com/mazmaker/chateau-platform
- Issues: https://github.com/mazmaker/chateau-platform/issues
