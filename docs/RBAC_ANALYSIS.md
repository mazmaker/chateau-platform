# เอกสารวิเคราะห์ระบบ Role-Based Access Control (RBAC)

**วันที่:** 2025-12-25
**เวอร์ชัน:** 1.0.0
**โปรเจกต์:** CHATEAU Platform
**สถานะ:** ✅ ใช้งานได้จริงผ่านการทดสอบ

---

## 📋 สารบัญ

1. [ภาพรวมระบบ](#ภาพรวมระบบ)
2. [โครงสร้าง Role และสิทธิ์](#โครงสร้าง-role-และสิทธิ์)
3. [สถาปัตยกรรมระบบ](#สถาปัตยกรรมระบบ)
4. [ตารางสิทธิ์แบบละเอียด](#ตารางสิทธิ์แบบละเอียด)
5. [การนำไปใช้งาน](#การนำไปใช้งาน)
6. [ประวัติการแก้ไข](#ประวัติการแก้ไข)

---

## 📖 ภาพรวมระบบ

### วัตถุประสงค์

ระบบ Role-Based Access Control (RBAC) ของ CHATEAU Platform ออกแบบมาเพื่อ:

1. **Multi-Tenant Isolation** - แยกข้อมูลระหว่างบริษัทแต่ละแห่ง 100%
2. **Role-Based Permissions** - กำหนดสิทธิ์ตามหน้าที่ในองค์กร
3. **Security First** - ป้องกันการเข้าถึงข้อมูลโดยไม่ได้รับอนุญาต
4. **Scalability** - รองรับการเพิ่ม Role ใหม่ในอนาคต

---

## 👥 โครงสร้าง Role และสิทธิ์

### Roles ที่มี:

| Role | ไอคอน | คำอธิบาย | ระดับสิทธิ์ |
|:---|:---:|:---|:---:|
| **Owner** | 👑 | เจ้าของระบบ/บริษัท | สูงสุด |
| **Admin** | 🔧 | ผู้บริหารระดับกลาง | ปานกลาง |
| **Sales** | 💼 | พนักงานขาย | ทั่วไป |

### ลำดับชั้นของสิทธิ์:

```
     👑 OWNER
        ├── ทำได้ทุกอย่าง
        ├── จัดการ Tenants
        ├── จัดการ Billing
        └── มอบหมายสิทธิ์ให้ Admin/Sales
                │
                ├── 🔧 ADMIN
                │   ├── จัดการ Properties
                │   ├── จัดการ Customers
                │   ├── จัดการ Bookings
                │   ├── ดู Dashboard
                │   └── ไม่มีสิทธิ์ Billing/Tenant
                │
                └── 💼 SALES
                    ├── ดู Properties (view only)
                    ├── สร้าง Bookings
                    ├── ดู Dashboard ของตัวเอง
                    └── ไม่มีสิทธิ์แก้ไข/delete
```

---

## 🏗️ สถาปัตยกรรมระบบ

### Component ที่เกี่ยวข้อง:

```
┌─────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION LAYER                     │
├─────────────────────────────────────────────────────────────────┤
│  1. Supabase Auth (auth.users)                                  │
│     ├── Email/Password authentication                            │
│     ├── Session management                                      │
│     └── JWT tokens                                              │
├─────────────────────────────────────────────────────────────────┤
│  2. Public Database Schema (public.users)                       │
│     ├── id (UUID) references auth.users                         │
│     ├── email                                                   │
│     ├── tenant_id (references tenants)                          │
│     ├── role (user_role enum: owner/admin/sales)               │
│     └── is_active (boolean)                                     │
├─────────────────────────────────────────────────────────────────┤
│  3. Row Level Security (RLS)                                    │
│     ├── SECURITY DEFINER functions                             │
│     │   ├── get_current_user_tenant_id()                       │
│     │   ├── user_has_role(required_role)                       │
│     │   ├── is_admin_or_above()                                │
│     │   └── is_owner()                                         │
│     └── RLS Policies on all tables                              │
├─────────────────────────────────────────────────────────────────┤
│  4. Application Layer (React)                                   │
│     ├── AuthContextSimple.tsx (State Management)               │
│     ├── ProtectedRouteSimple.tsx (Route Guards)                │
│     └── App.tsx (Route Configuration)                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📊 ตารางสิทธิ์แบบละเอียด

### 1. การเข้าถึงหน้า (Page Access)

| Path | หน้าเว็บ | Owner | Admin | Sales | หมายเหตุ |
|:---|:---|:---:|:---:|:---:|:---|
| `/auth/login` | หน้าล็อกอิน | ✅ | ✅ | ✅ | Guest only |
| `/` | Dashboard หลัก | ✅ | ✅ | ✅ | Logged in |
| `/users` | จัดการ Users | ✅ | ✅ | ✅ | Logged in |
| `/projects` | โครงการ | ✅ | ✅ | ✅ | Logged in |
| `/owner` | Owner Dashboard | ✅ | ❌ | ❌ | Owner only |
| `/tenants` | จัดการ Tenant | ✅ | ❌ | ❌ | Owner only |
| `/billing` | บิล/การเงิน | ✅ | ❌ | ❌ | Owner only |
| `/properties` | จัดการอสังหา | ✅ | ✅ | ✅ | Logged in |
| `/leads` | จัดการ Leads | ✅ | ✅ | ✅ | Logged in |
| `/customization` | ปรับแต่งระบบ | ✅ | ✅ | ✅ | Logged in |

### 2. สิทธิ์ CRUD ตาม Role

| ตาราง | Action | Owner | Admin | Sales |
|:---|:---|:---:|:---:|:---:|
| **users** | Create | ✅ | ✅ | ❌ |
| | Read (own tenant) | ✅ | ✅ | ✅ |
| | Update | ✅ | ✅ (subordinate) | ❌ |
| | Delete | ✅ | ❌ | ❌ |
| **tenants** | Read (own) | ✅ | ❌ | ❌ |
| | Update | ✅ | ❌ | ❌ |
| **properties** | Create | ✅ | ✅ | ❌ |
| | Read (own tenant) | ✅ | ✅ | ✅ |
| | Update | ✅ | ✅ | ❌ |
| | Delete | ✅ | ❌ | ❌ |
| **customers** | Create | ✅ | ✅ | ✅ |
| | Read (own tenant) | ✅ | ✅ | ✅ |
| | Update | ✅ | ✅ | ❌ |
| | Delete | ✅ | ❌ | ❌ |
| **bookings** | Create | ✅ | ✅ | ✅ |
| | Read (own tenant) | ✅ | ✅ | ✅ |
| | Update | ✅ | ✅ | ❌ |
| | Delete | ✅ | ❌ | ❌ |

---

## 🔧 การนำไปใช้งาน

### Files หลักที่เกี่ยวข้อง:

| File | หน้าที่ | Location |
|:---|:---|:---|
| **AuthContextSimple.tsx** | State management และ auth logic | `src/contexts/` |
| **ProtectedRouteSimple.tsx** | Route guards ตรวจสอบ permissions | `src/components/auth/` |
| **App.tsx** | Route configuration | `src/` |
| **20250123000000_fix_rls_infinite_recursion.sql** | RLS policies & functions | `supabase/migrations/` |
| **20250122010000_update_to_3_roles.sql** | 3-role system schema | `supabase/migrations/` |

### เพิ่ม Role ใหม่ในอนาคต:

```typescript
// 1. อัปเดต Enum
ALTER TYPE user_role ADD VALUE 'manager';

// 2. อัปเดต AuthContext
userRole: 'owner' | 'admin' | 'sales' | 'manager' | null

// 3. อัปเดต ProtectedRoute
requireRole?: 'owner' | 'admin' | 'sales' | 'manager'

// 4. เพิ่ม Function ใหม่ (ถ้าจำเป็น)
CREATE OR REPLACE FUNCTION is_manager_or_above()
...
```

---

## 📝 ประวัติการแก้ไข

### Version 1.0.0 (2025-12-25)

| วันที่ | ปัญหา | วิธีแก้ไข | ไฟล์ที่เกี่ยวข้อง |
|:---|:---|:---|:---|
| 2025-12-23 | Initial setup ไม่มี role system | สร้าง 3-role system | `20250122010000_update_to_3_roles.sql` |
| 2025-12-23 | Users ไม่ sync ไปยัง public.users | สร้าง sync script | `run-sync.cjs` |
| 2025-12-24 | `sales@chateau.com` ถูกตั้งเป็น admin | อัปเดต role เป็น sales | `20250123000002_fix_sales_user_role.sql` |
| 2025-12-25 | RLS infinite recursion | สร้าง SECURITY DEFINER functions | `20250123000000_fix_rls_infinite_recursion.sql` |
| 2025-12-25 | Admin/Sales เห็น dashboard เป็นภาษาไทยไม่ได้ | แก้ locale issue | `AuthContextSimple.tsx:405` |

### Test Users ปัจจุบัน:

| Email | Role | Password | สถานะ |
|:---|:---:|:---|:---:|
| mazmakerv2.sup@gmail.com | 👑 OWNER | Chateau2025! | ✅ Active |
| admin@chateau.com | 🔧 ADMIN | Admin123! | ✅ Active |
| sales@chateau.com | 💼 SALES | Sales123! | ✅ Active |
| ~~viewer@chateau.com~~ | ~~👑 OWNER~~ | - | ❌ Deleted |

---

## 🧪 ขั้นตอนการทดสอบ

### 1. Test Login (ทุก Role)
```bash
# เปิด http://localhost:5175/auth/login
# ล็อกอินด้วย user แต่ละ role
# ตรวจสอบ console logs
```

### 2. Test Role-Based Access
```bash
# ล็อกอินด้วย admin@chateau.com
# ลองเข้า http://localhost:5175/owner
# คาดหวัง: เห็น "ไม่มีสิทธิ์เข้าถึง ต้องการ: owner"
```

### 3. Test RLS Policies
```sql
-- เช็คว่า RLS ทำงาน
SELECT * FROM users WHERE email = 'admin@chateau.com';

-- เช็ค policies
SELECT * FROM pg_policies WHERE tablename = 'users';
```

---

## 📚 References

### Internal Documents:
- [PRD](../documents/PRD.md) - FR001-FR064
- [Constitution](../.specify/memory/constitution.md) - 8 principles
- [Tasks](../specs/002-production-readiness/tasks.md) - 105 tasks
- [Database Schema](../docs/DATABASE_SCHEMA.md)

### External References:
- [Supabase RLS](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)

---

**เอกสารนี้สร้างโดย:** Supabase Agent
**วันที่สร้าง:** 2025-12-25
**เวอร์ชัน:** 1.0.0
