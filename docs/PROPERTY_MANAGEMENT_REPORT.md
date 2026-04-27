# 📊 รายงานการทำงานของหน้า Property Management

> **URL:** `http://localhost:5173/properties`
> **Source:** [src/pages/PropertyManagement.tsx](../src/pages/PropertyManagement.tsx) (2,185 บรรทัด)
> **วันที่จัดทำ:** 2026-04-27
> **Branch:** `001-production-readiness`

---

## 📑 สารบัญ

1. [ภาพรวม (Overview)](#1-ภาพรวม-overview)
2. [สิทธิ์การเข้าถึง (Permissions)](#2-สิทธิ์การเข้าถึง-permissions)
3. [โครงสร้างหน้า (Page Structure)](#3-โครงสร้างหน้า-page-structure)
4. [การเชื่อมต่อฐานข้อมูล (Database Integration)](#4-การเชื่อมต่อฐานข้อมูล-database-integration)
5. [View 1: รายการโครงการ (Projects List)](#5-view-1-รายการโครงการ-projects-list)
6. [View 2: รายละเอียดยูนิต (Units List)](#6-view-2-รายละเอียดยูนิต-units-list)
7. [Modals & Dialogs](#7-modals--dialogs)
8. [การอัปโหลดรูปภาพ (Image Upload)](#8-การอัปโหลดรูปภาพ-image-upload)
9. [Activity Logging](#9-activity-logging)
10. [State Management](#10-state-management)
11. [Helper Functions](#11-helper-functions)
12. [การ Validate ข้อมูล](#12-การ-validate-ข้อมูล)
13. [Edge Cases & Error Handling](#13-edge-cases--error-handling)
14. [ปัญหาที่พบและข้อเสนอแนะ](#14-ปัญหาที่พบและข้อเสนอแนะ)

---

## 1. ภาพรวม (Overview)

หน้า **Property Management** เป็นหน้าจัดการ "โครงการอสังหาริมทรัพย์" และ "ยูนิต" ภายในแต่ละโครงการ ทำงานบน
multi-tenant architecture (แต่ละ tenant เห็นข้อมูลเฉพาะของตัวเอง)

### 🎯 จุดประสงค์หลัก
- **สร้าง/แก้ไข/ลบ** โครงการ (Project) เช่น คอนโด, บ้านเดี่ยว, ทาวน์โฮม
- **สร้าง/แก้ไข/ลบ** ยูนิต (Unit) ภายในแต่ละโครงการ
- **ดูสถิติ** ยูนิตที่ว่าง / จอง / ขายแล้ว / มูลค่ารวม
- **เพิ่ม Lead** จากยูนิตที่ลูกค้าสนใจ
- **อัปโหลดรูป** ทั้ง thumbnail และ gallery
- **ค้นหา / กรอง** โครงการและยูนิตตามเงื่อนไขต่างๆ

### 📊 ปริมาณข้อมูลปัจจุบันใน DB
| Table | จำนวน Records |
|-------|---------------|
| `properties` | 52 |
| `projects` | 54 |
| `units` | 143 |
| `lead_interests` | 11 |

> ⚠️ **หมายเหตุ:** มี 2 ตารางสำหรับโครงการ (`properties` และ `projects`) ทำงานคู่กัน — ดูรายละเอียดใน [section 14](#14-ปัญหาที่พบและข้อเสนอแนะ)

---

## 2. สิทธิ์การเข้าถึง (Permissions)

หน้านี้ใช้ Permission Guard 2 ชั้น:

### 🔐 Guard ที่ใช้งาน
| Guard | สิทธิ์ที่ผ่าน | ใช้ห่อ |
|-------|--------------|--------|
| `ViewPropertiesGuard` | OWNER, ADMIN, SALES | ทั้งหน้า (Read-only views) |
| `ManagePropertiesGuard` | OWNER, ADMIN | ปุ่ม สร้าง/แก้ไข/ลบ (Mutations) |

### 📋 ตารางสิทธิ์ที่ละเอียด

| Action | OWNER | ADMIN | SALES |
|--------|:-----:|:-----:|:-----:|
| ดูรายการโครงการ | ✅ | ✅ | ✅ |
| ดูสถิติโครงการ | ✅ | ✅ | ✅ |
| ดูยูนิตในโครงการ | ✅ | ✅ | ✅ |
| ดูรายละเอียดยูนิต | ✅ | ✅ | ✅ |
| **เพิ่มโครงการใหม่** | ✅ | ✅ | ❌ |
| **แก้ไขโครงการ** | ✅ | ✅ | ❌ |
| **ลบโครงการ** | ✅ | ✅ | ❌ |
| **เพิ่มยูนิตใหม่** | ✅ | ✅ | ❌ |
| **แก้ไขยูนิต** | ✅ | ✅ | ❌ |
| **ลบยูนิต** | ✅ | ✅ | ❌ |
| เพิ่ม Lead จากยูนิต | ✅ | ✅ | ✅ |

### 🛡️ การ Redirect
หากผู้ใช้ไม่ได้ login → redirect ไปที่ `/auth/login`
หากผู้ใช้ไม่มี `currentTenant` → แสดงข้อความ "กรุณาเลือกบริษัทก่อน"

---

## 3. โครงสร้างหน้า (Page Structure)

หน้านี้มี **2 View หลัก** ที่ toggle กันด้วย state `selectedProperty`:

```
┌─────────────────────────────────────────────────┐
│  PropertyManagement                              │
│  ┌──────────┐  ┌─────────────────────────────┐  │
│  │ Sidebar  │  │  Header                     │  │
│  │          │  ├─────────────────────────────┤  │
│  │ • Menu   │  │                             │  │
│  │   List   │  │  ┌───────────────────────┐  │  │
│  │          │  │  │ View 1:               │  │  │
│  │          │  │  │ Projects List         │  │  │
│  │          │  │  │ (selectedProperty=null)│  │  │
│  │          │  │  └───────────────────────┘  │  │
│  │          │  │                             │  │
│  │          │  │       OR (toggle)           │  │
│  │          │  │                             │  │
│  │          │  │  ┌───────────────────────┐  │  │
│  │          │  │  │ View 2:               │  │  │
│  │          │  │  │ Units List            │  │  │
│  │          │  │  │ (selectedProperty≠null)│  │  │
│  │          │  │  └───────────────────────┘  │  │
│  └──────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### 🧩 Components ที่ใช้
- **Layout:** `Sidebar`, `Header` (import โดยตรง — ยังไม่ใช้ DashboardLayout)
- **UI Library:** shadcn/ui (Card, Button, Input, Dialog, Select, Tabs, Table, Badge, DropdownMenu)
- **External Modal Components:**
  - [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx) — สร้าง/แก้ไขโครงการ
  - [AddLeadModal.tsx](../src/components/leads/AddLeadModal.tsx) — เพิ่ม Lead จากยูนิต

---

## 4. การเชื่อมต่อฐานข้อมูล (Database Integration)

### 📂 ตารางที่ใช้งาน

| Table | บทบาท | Operations |
|-------|-------|------------|
| `properties` | โครงการแบบเก่า (legacy) | SELECT, INSERT, UPDATE, DELETE |
| `projects` | โครงการแบบใหม่ (มี structure ละเอียด) | SELECT, INSERT, UPDATE |
| `units` | ยูนิตในแต่ละโครงการ | SELECT, INSERT, UPDATE, DELETE |
| `lead_interests` | ความสนใจของ lead ต่อยูนิต | SELECT (joined) |
| `customers` | ลูกค้า (joined ผ่าน leads) | SELECT (joined) |
| `users` | พนักงานขายที่ดูแล lead | SELECT (joined) |
| `th_provinces` | จังหวัด (Thai location) | SELECT (ใน CreateProjectModal) |
| `th_districts` | อำเภอ | SELECT |
| `th_sub_districts` | ตำบล | SELECT |
| `zipcodes` | รหัสไปรษณีย์ | SELECT |

### 🔄 Queries หลัก

#### 4.1 `fetchProperties()` — ดึงโครงการทั้งหมด
```typescript
// 1. ดึงจาก properties table
.from('properties').select('*').eq('tenant_id', currentTenant.id)
   .order('created_at', { ascending: false })

// 2. ดึงจาก projects table (สำหรับโครงการที่ structure ละเอียดกว่า)
.from('projects').select('*').eq('tenant_id', currentTenant.id)
   .order('created_at', { ascending: false })

// 3. Map projects → Property interface และ merge เข้าด้วยกัน
```

#### 4.2 `fetchUnits(projectId)` — ดึงยูนิตในโครงการ
```typescript
.from('units').select('*')
   .eq('project_id', projectId)
   .order('unit_number', { ascending: true })
```

#### 4.3 `fetchMinPrices(propertyIds)` — ดึงราคาต่ำสุดในแต่ละโครงการ
```typescript
.from('units').select('project_id, price')
   .eq('tenant_id', currentTenant.id)
   .in('project_id', propertyIds)
   .gt('price', 0)
// แล้ว reduce หา min ของแต่ละ project_id
```

#### 4.4 `fetchUnitLeads(unitId)` — ดึง lead ที่สนใจยูนิต
```typescript
.from('lead_interests').select(`
  *,
  leads:lead_id (
    id, status, source, notes, created_at,
    customers:customer_id ( id, full_name, email, phone ),
    users:assigned_to ( id, full_name, email )
  )
`)
.eq('unit_id', unitId)
.eq('tenant_id', currentTenant.id)
.order('created_at', { ascending: false })
```

### 🔁 useEffect Dependencies
| Effect | Dependency | ทำงานเมื่อ |
|--------|-----------|-----------|
| `fetchProperties()` | `[currentTenant]` | เปลี่ยน tenant หรือ mount |
| `fetchUnits(selectedProperty.id)` | `[selectedProperty]` | เลือก/ยกเลิกโครงการ |
| `fetchMinPrices(propertyIds)` | `[properties]` | properties โหลดเสร็จ |

---

## 5. View 1: รายการโครงการ (Projects List)

แสดงเมื่อ `selectedProperty === null`

### 📊 KPI Cards (4 ใบ)

| Card | คำนวณจาก | ตัวอย่าง |
|------|---------|---------|
| 🏢 **โครงการทั้งหมด** | `properties.length` | 52 |
| 📐 **ยูนิตทั้งหมด** | `properties.reduce((s,p) => s + p.total_units)` | 1,234 |
| 📈 **โครงการที่เปิดขาย** | `properties.filter(p => p.is_active).length` | 48 |
| 💰 **มูลค่ารวม** | `Σ (base_price × total_units)` | ฿XX,XXX,XXX |

### 🔍 ตัวกรอง (Filters)

| ตัวกรอง | ตัวเลือก | Logic |
|---------|---------|-------|
| **ค้นหา** | textbox | `property.name.toLowerCase().includes(query)` |
| **ประเภท** | ทุกประเภท / คอนโด / บ้านเดี่ยว / บ้านแฝด / ทาวน์โฮม / วิลล่า / อพาร์ตเมนท์ / อาคารพาณิชย์ | `property.type === filter` |

### 🎴 Project Cards (Grid 3 columns)

แต่ละ card แสดง:
- **รูป Thumbnail** หรือ icon Building2 (fallback)
- **Badge "แนะนำ"** (ถ้า `is_featured`)
- **Badge ประเภทโครงการ** (มุมขวาบน)
- **ชื่อโครงการ**
- **ที่ตั้ง** (อำเภอ + จังหวัด)
- **Stats:**
  - จำนวนยูนิต (`total_units`)
  - จำนวนชั้น (`floor_count`)
  - ผู้พัฒนา (`developer`)
- **ราคาเริ่มต้น** (สีเขียว, format ย่อ เช่น "2.5 ล้านบาท")
  - ใช้ `minPrices[property.id]` ถ้ามี — fallback `property.base_price`
- **Click Action:** เลือกโครงการ → ไป View 2

### 🔘 ปุ่ม "เพิ่มโครงการใหม่"
- มุมขวาบน, ห่อด้วย `ManagePropertiesGuard`
- เปิด `CreateProjectModal` (mode: create)

---

## 6. View 2: รายละเอียดยูนิต (Units List)

แสดงเมื่อ `selectedProperty !== null`

### 🔙 ปุ่ม "← กลับไปรายการโครงการ"
- คลิก → `setSelectedProperty(null)` → กลับ View 1

### 📋 Property Info Card
- **ชื่อโครงการ** + **ที่ตั้ง**
- **คำอธิบาย** (description)
- **ปุ่ม แก้ไข / ลบ** (สำหรับ ManagePropertiesGuard)

### 📊 Units Stats (4 KPI cards)

| Card | คำนวณ |
|------|-------|
| 🏢 **ยูนิตทั้งหมด** | `units.length` |
| 🏠 **ว่างขาย** | `units.filter(u => u.status === 'available').length` |
| 📈 **ขายแล้ว** | `units.filter(u => u.status === 'sold').length` |
| 💰 **มูลค่ารวม** | `Σ unit.price` |

### 🔍 Filter

| ตัวกรอง | ตัวเลือก |
|---------|---------|
| **ค้นหาเลขที่ยูนิต** | textbox (ปัจจุบัน UI พร้อม แต่ logic ยังไม่ได้ filter จริง) |
| **สถานะ** | ทุกสถานะ / ว่าง / จอง / ขายแล้ว |

### 📑 Units Table

| Column | Source |
|--------|--------|
| เลขที่ | `unit.unit_number` |
| ชั้น | `ชั้น ${unit.floor_number}` |
| ขนาด | `${unit.area_sqm.toLocaleString()} ตร.ม.` |
| ห้องนอน/น้ำ | icon Bed + `bedrooms`, icon Bath + `bathrooms` |
| ราคา | `formatCurrency(unit.price)` (THB) |
| สถานะ | `<Badge>` พร้อม label (ว่าง / จอง / ขายแล้ว / ไม่ว่าง) |
| ดำเนินการ | DropdownMenu |

### 🔘 Dropdown Actions ในแต่ละแถว

| Action | สิทธิ์ | ทำอะไร |
|--------|--------|---------|
| 👁️ **ดูรายละเอียด** | ทุกคน | เปิด `Unit Detail Dialog` + load leads ของยูนิตนี้ |
| 👤 **เพิ่ม Lead ใหม่** | ทุกคน | เปิด `AddLeadModal` พร้อม pre-fill propertyId, unitId |
| ✏️ **แก้ไข** | OWNER, ADMIN | เปิด Unit Dialog (mode: edit) |
| 🗑️ **ลบ** | OWNER, ADMIN | เปิด Delete Confirmation Dialog |

### 🔘 ปุ่ม "เพิ่มยูนิตใหม่"
- มุมขวาบนของ table actions, ห่อด้วย `ManagePropertiesGuard`
- เปิด Unit Dialog (mode: create)

---

## 7. Modals & Dialogs

### 7.1 🟣 Create/Edit Project Modal
**Component:** [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx)
**ใช้สำหรับ:** สร้าง/แก้ไขโครงการ (toggle mode ด้วย `editingProject` prop)

#### Form Fields
| ส่วน | Field | ประเภท | Validation |
|------|-------|--------|------------|
| **ข้อมูลพื้นฐาน** | ชื่อโครงการ | text | required |
| | ประเภทโครงการ | select (4 ตัว: บ้านเดี่ยว/บ้านแฝด/ทาวน์โฮม/คอนโด) | required |
| | จำนวนยูนิตทั้งหมด | number | optional |
| | จำนวนชั้น | number | optional |
| | มี facilities? | radio (yes/no) | optional |
| | ผู้พัฒนา | text | optional |
| **ที่ตั้ง** | ที่อยู่ (street) | text | optional |
| | จังหวัด | dropdown (cascade จาก `th_provinces`) | optional |
| | อำเภอ | dropdown (cascade จาก `th_districts`) | optional |
| | ตำบล | dropdown (cascade จาก `th_sub_districts`) | optional |
| | รหัสไปรษณีย์ | auto-fetch จาก zipcodes table | auto |
| **รูปภาพ** | Thumbnail | file (single image) | optional |
| | Gallery | file (multiple images) | optional |
| **ลิงก์ข้อมูล** | Sale Kit URL | url | optional |
| | Fact Sheet URL | url | optional |
| | ROI Calculator URL | url | optional |
| **ไฟล์แนบ** | Attachments | files (multiple) | optional |
| **สถานะ** | is_active | switch | default: true |
| | is_featured | switch | default: false |

#### การ Save
1. Upload thumbnail/gallery/attachments → Supabase Storage
2. Insert/Update เข้า `properties` table
3. ถ้าเป็น create → Insert เข้า `projects` table ด้วย (id เดียวกัน) เพื่อ FK ของ units
4. Refresh list → ปิด modal

#### Cascading Dropdowns Logic
- เลือกจังหวัด → fetch districts ของจังหวัดนั้น
- เลือกอำเภอ → fetch sub-districts ของอำเภอนั้น
- เลือกตำบล → fetch zipcode อัตโนมัติ
- ใน edit mode: pre-load ทุก level พร้อมกันก่อน setFormData (ป้องกัน cascading reset)

---

### 7.2 🔵 Unit Add/Edit Dialog
**Inline ใน:** [PropertyManagement.tsx:1364-1734](../src/pages/PropertyManagement.tsx#L1364-L1734)

#### Form Sections
1. **ข้อมูลพื้นฐาน** (Section 1, สีน้ำเงิน)
   - เลขที่ยูนิต `*` (required)
   - เลขที่ชั้น
   - ราคา (฿) `*` (required)

2. **รูปภาพยูนิต** (Section 2, สีม่วง)
   - Thumbnail (single) — preview + ปุ่มลบ
   - Gallery (multiple) — grid 5 cols + ปุ่มเพิ่ม/ลบรายตัว

3. **ขนาดพื้นที่** (Section 3, สีเขียว)
   - พื้นที่ใช้สอย (ตร.ม.)
   - พื้นที่ดิน (ตร.ว.)

4. **จำนวนห้อง** (Section 4, สีส้ม)
   - ห้องนอน
   - ห้องน้ำ
   - จำนวนชั้น

5. **รายละเอียดและสถานะ** (Section 5, สีเทา)
   - ข้อมูลเพิ่มเติม (textarea)
   - สถานะยูนิต (select: available / reserved / sold / unavailable)

#### Footer
- ปุ่ม **ยกเลิก** (กลับโดยไม่บันทึก)
- ปุ่ม **บันทึก/เพิ่มยูนิต** (disabled ถ้าไม่กรอก unit_number หรือ price)
  - แสดง spinner ระหว่างบันทึก

#### Memory Management
- ใช้ `URL.createObjectURL()` สำหรับ preview
- เรียก `URL.revokeObjectURL()` ทุกครั้งที่ลบ/reset เพื่อป้องกัน memory leak

---

### 7.3 🟦 Unit Detail Dialog
**Inline ใน:** [PropertyManagement.tsx](../src/pages/PropertyManagement.tsx) (มี `showUnitDetailDialog` state)

แสดงเมื่อกด "ดูรายละเอียด" จาก dropdown
- **ข้อมูลยูนิต** ครบถ้วน (เลขที่, ชั้น, พื้นที่, ราคา, ห้อง, สถานะ ฯลฯ)
- **Gallery รูปภาพ**
- **รายการ Lead ที่สนใจยูนิตนี้** (ดึงจาก `fetchUnitLeads(unitId)`)
  - แสดง: ชื่อลูกค้า, สถานะ lead, แหล่งที่มา, พนักงานขายที่ดูแล, วันที่สร้าง

---

### 7.4 🔴 Delete Project Confirmation Dialog
**Inline ใน:** [PropertyManagement.tsx:1737+](../src/pages/PropertyManagement.tsx#L1737)

- Header: gradient ม่วง + icon AlertTriangle
- Message: "คุณแน่ใจหรือไม่ว่าต้องการลบโครงการ '${selectedProperty.name}'?"
- ปุ่ม: **ยกเลิก** / **ยืนยันการลบ** (สีแดง)

⚠️ **การลบ Cascade:** ลบจาก `properties` → ยูนิตที่ FK ไปยัง project_id อาจมี orphan (ไม่มี cascade delete)

---

### 7.5 🔴 Delete Unit Confirmation Dialog
- คล้าย delete project แต่สำหรับยูนิต
- Message: "คุณแน่ใจหรือไม่ว่าต้องการลบยูนิต '${unit.unit_number}'?"

---

### 7.6 🟢 Add Lead Modal
**Component:** [AddLeadModal.tsx](../src/components/leads/AddLeadModal.tsx)
**Pre-filled ด้วย:** `propertyId`, `propertyName`, `unitId`, `unitNumber`

- เมื่อสร้าง lead สำเร็จ → navigate ไป `/leads`

---

## 8. การอัปโหลดรูปภาพ (Image Upload)

### 📦 Storage Bucket
ใช้ Supabase Storage bucket ชื่อ **`units`**

### 📁 Folder Structure
```
units/
└── {tenant_id}/
    └── {project_id}/
        ├── thumbnails/
        │   └── {timestamp}-{random}.{ext}
        └── gallery/
            └── {timestamp}-{random}.{ext}
```

### 🔄 Upload Function: `uploadUnitImage(file, folder)`
1. สร้าง file path ที่ unique
2. Upload ด้วย `supabase.storage.from('units').upload()`
3. ดึง public URL ด้วย `getPublicUrl()`
4. Return URL หรือ `null` ถ้าผิดพลาด

### ⚙️ Settings
- `cacheControl: '3600'` (1 hour cache)
- `upsert: false` (ป้องกันเขียนทับ)

### 🖼️ การแสดงผล
- ใช้ `URL.createObjectURL()` สำหรับ preview ก่อน upload
- หลัง save: ดึงจาก `images[]` array ใน DB record

---

## 9. Activity Logging

ทุกการกระทำสำคัญจะ log ผ่าน `supabase.rpc('log_activity', {...})`

### 📝 Activities ที่บันทึก

| Action | activity_type | description format |
|--------|---------------|-------------------|
| สร้างโครงการ | `property_created` | `สร้างโครงการใหม่: {name}` |
| แก้ไขโครงการ | `property_updated` | `แก้ไขโครงการ: {name}` |
| ลบโครงการ | `property_deleted` | `ลบโครงการ: {name}` |
| สร้างยูนิต | `unit_created` | `สร้างยูนิตใหม่: {unit_number} ({project_name})` |
| แก้ไขยูนิต | `unit_updated` | `แก้ไขยูนิต: {unit_number} ({project_name})` |
| ลบยูนิต | `unit_deleted` | `ลบยูนิต: {unit_number} ({project_name})` |

### 📦 Metadata ที่ log
ทุก action จะแนบ metadata เช่น:
- `property_id`, `project_id`, `unit_id`
- `property_name`, `project_name`, `unit_number`
- `type` (project type)
- `status` (สำหรับ unit)

> 💡 **Note:** ทุก log ห่อด้วย try/catch แยก — ถ้า log ผิดพลาดไม่ block flow หลัก

---

## 10. State Management

ใช้ React `useState` ทั้งหมด (no Redux/Zustand) — รวม **30+ states**

### 📋 Categories ของ State

#### 10.1 Data States
- `properties` — list ของโครงการ
- `selectedProperty` — โครงการที่เลือก (null = แสดง list, object = แสดง units)
- `units` — list ของยูนิตในโครงการที่เลือก
- `unitLeads` — leads ที่สนใจยูนิต (สำหรับ Detail Dialog)
- `minPrices` — Map ของ project_id → ราคาต่ำสุด

#### 10.2 UI States
- `loading` — กำลังโหลด properties
- `savingUnit` — กำลังบันทึกยูนิต (แสดง spinner)
- `sidebarOpen` — sidebar mobile

#### 10.3 Filter/Search States
- `searchQuery` — ค้นหาชื่อโครงการ
- `typeFilter` — กรองประเภทโครงการ
- `statusFilter` — กรองสถานะยูนิต

#### 10.4 Dialog States (toggle visibility)
- `showPropertyDialog`, `showUnitDialog`, `showDeleteDialog`
- `showUnitDetailDialog`, `showDeleteUnitDialog`
- `showAddLeadModal`

#### 10.5 Editing States (ระบุเป้าหมายของ action)
- `editingProperty` — โครงการที่กำลังแก้
- `editingUnit` — ยูนิตที่กำลังแก้
- `viewingUnit` — ยูนิตที่กำลังดู
- `deletingUnit` — ยูนิตที่กำลังจะลบ
- `selectedUnitForLead` — ยูนิตที่จะใช้สร้าง lead

#### 10.6 Form States (controlled inputs)
- `propertyForm` — object สำหรับ form โครงการ (legacy — modal ใหม่ใช้ formData ใน CreateProjectModal)
- `unitForm` — object สำหรับ form ยูนิต (12 fields)

---

## 11. Helper Functions

### 11.1 `formatPriceShort(amount)`
แปลงราคาเป็นรูปย่อ:
- ≥ 1,000,000 → `"X.X ล้านบาท"`
- ≥ 1,000 → `"X พันบาท"`
- < 1,000 → `"X บาท"`

### 11.2 `formatCurrency(amount)`
ใช้ `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })`
ตัวอย่าง: `formatCurrency(2500000)` → `"฿2,500,000"`

### 11.3 `getPropertyTypeLabel(type)`
แปลง code → ชื่อภาษาไทย:
- `apartment` → "อพาร์ตเมนท์"
- `single_house` / `house` → "บ้านเดี่ยว"
- `twin_house` → "บ้านแฝด"
- `townhome` → "ทาวน์โฮม"
- `villa` → "วิลล่า"
- `condo` → "คอนโด"
- `commercial` → "อาคารพาณิชย์"

### 11.4 `getUnitStatusBadge(status)`
แสดง Badge component ตามสถานะ:
- `available` → "ว่าง" (default variant)
- `reserved` → "จอง" (secondary variant)
- `sold` → "ขายแล้ว" (destructive variant)
- `unavailable` → "ไม่ว่าง" (outline variant)

### 11.5 Image Handlers
- `handleThumbnailChange` — เลือก thumbnail
- `removeThumbnail` — ลบ thumbnail (revoke ObjectURL)
- `handleImagesChange` — เลือก gallery (multiple)
- `removeImage(index)` — ลบรูปที่ index (revoke ObjectURL)

---

## 12. การ Validate ข้อมูล

### ✅ Form-level Validation
- **Project Form** (CreateProjectModal):
  - `name` required
  - `project_type` required
- **Unit Form**:
  - `unit_number` required
  - `price` required
  - ปุ่ม Save จะ disabled ถ้าทั้งสองไม่ครบ

### ⚠️ การ Parsing
- `parseFloat()` สำหรับ price, area
- `parseInt()` สำหรับ floor, bedrooms, bathrooms
- `null` ถ้า field ว่าง (สำหรับ optional numerics)

### ❌ Server-side Validation
ไม่มีในโค้ด frontend — พึ่งพา DB constraint และ RLS ของ Supabase

---

## 13. Edge Cases & Error Handling

### 🔄 Edge Cases ที่ Handle

| Case | Behavior |
|------|----------|
| ไม่มี `currentTenant` | แสดงหน้า "กรุณาเลือกบริษัทก่อน" |
| `properties` ว่าง | แสดง "ไม่พบโครงการ" + icon |
| `units` ว่าง | แสดง "ไม่พบยูนิต" ในแถว table |
| ไม่มี `thumbnail_url` | แสดง icon Building2 fallback |
| ราคา = 0 | แสดง `"-"` (จาก `formatPriceShort`) |
| `floor_number` = null | แสดง `"-"` |
| `area_sqm` = null | แสดง `"-"` |
| Image upload error | log + return null (ไม่ crash) |
| log_activity error | catch + ignore (ไม่ block flow) |

### ❗ Error Handling
- ทุก `async` function ห่อด้วย `try/catch`
- ใช้ `console.error()` เป็นหลัก
- Unit save errors → `alert()` แสดง message
- Property save errors → log ลง console เท่านั้น (ไม่แจ้ง user!)

---

## 14. ปัญหาที่พบและข้อเสนอแนะ

### 🚨 ปัญหาเชิง Architecture

#### 14.1 ⚠️ ตาราง `properties` กับ `projects` ทำงานคู่กัน — สับสน
- เมื่อสร้างโครงการใหม่ → insert ทั้ง `properties` และ `projects` ที่ id เดียวกัน
- เมื่อ fetch → query ทั้ง 2 ตาราง แล้ว merge
- **สาเหตุ:** เพราะ FK ของ `units` ชี้ไปที่ `projects.id` ไม่ใช่ `properties.id`
- **ผลกระทบ:** Race condition ถ้า insert/update 2 ตารางไม่ atomic
- **แนะนำ:** Refactor — ตัดสินใจใช้ตารางเดียวและสร้าง migration ย้ายข้อมูล

#### 14.2 ⚠️ ตัวกรอง "ค้นหาเลขที่ยูนิต" ใน View 2 ไม่ทำงาน
- มี Input UI แต่**ไม่ได้ผูก `onChange`** กับ state
- `filteredUnits` กรองด้วย `statusFilter` เท่านั้น ไม่รวม search
- **แก้:** เพิ่ม state + bind onChange + เพิ่มเงื่อนไขใน filter

#### 14.3 ⚠️ การลบโครงการไม่ลบ Units
- `handleDeleteProperty` ลบจาก `properties` table อย่างเดียว
- ยูนิตที่ FK ไปที่ `projects` table จะกลายเป็น orphan
- **แนะนำ:** เพิ่ม cascade delete ใน DB หรือ delete units ก่อน

### 🔧 ปัญหาเชิง Code Quality

#### 14.4 ⚠️ ไม่มี Toast/Notification เมื่อทำสำเร็จ
- ใช้แค่ `console.error` หรือ `alert()` (สำหรับ unit error)
- แนะนำใช้ shadcn `Toast` หรือ `Sonner` (มี dependencies แล้ว)

#### 14.5 ⚠️ Sidebar ใช้ pattern เก่า ไม่ใช่ DashboardLayout
- หน้านี้ import Sidebar/Header เอง — ยังไม่ได้ migrate เข้า DashboardLayout
- ทำให้ sidebar state แยกของแต่ละหน้า — ขัดกับ pattern ใหม่

#### 14.6 ⚠️ State มี 30+ ตัว — ควรย่อยเป็น custom hooks
ตัวอย่าง:
- `useProperties()` — จัดการ properties + units
- `usePropertyForm()` — จัดการ form
- `useUnitForm()` — จัดการ unit form

#### 14.7 ⚠️ Dialog logic ผูกอยู่ในไฟล์เดียวกัน 2,185 บรรทัด
- Unit Dialog ขนาด ~300 บรรทัดควรแยกเป็น `<UnitFormModal />` component
- Detail Dialog ก็ควรแยก

### 🐛 Bugs ที่พบ
- **Project Save Error ไม่แจ้ง user** — ใช้แค่ `console.error` (line 428)
- **Property Form ไม่ใช้แล้ว** — มี `propertyForm` state แต่ไม่มี form UI ที่ใช้ (ใช้ CreateProjectModal แทน) — dead code

### 💡 ข้อเสนอแนะ

| # | ข้อเสนอ | ความสำคัญ |
|---|---------|----------|
| 1 | Refactor properties/projects ให้เป็นตารางเดียว | 🔴 High |
| 2 | แก้ search ยูนิตให้ทำงาน | 🟡 Medium |
| 3 | เพิ่ม cascade delete | 🟡 Medium |
| 4 | ใช้ Toast แทน alert/console | 🟡 Medium |
| 5 | Migrate ไปใช้ DashboardLayout | 🟢 Low |
| 6 | แยก components ย่อย | 🟢 Low |
| 7 | ลบ dead code (propertyForm) | 🟢 Low |
| 8 | เพิ่ม pagination ใน units table | 🟢 Low |
| 9 | เพิ่ม sort columns | 🟢 Low |
| 10 | เพิ่ม bulk actions (multi-select) | 🟢 Low |

---

## 📌 สรุป

หน้า Property Management เป็นหน้า**ที่ใช้งานข้อมูลจริงทั้งหมด** ดึงจาก Supabase DB แบบ real-time ไม่มี mock data
มีฟีเจอร์ครบถ้วน CRUD + Image Upload + Activity Logging + Lead Linking
แต่มีปัญหาทาง architecture ที่ควร refactor เพื่อความ maintainable ในระยะยาว

### 🔢 ตัวเลขสำคัญ
- **2,185 บรรทัด** ในไฟล์ PropertyManagement.tsx
- **52 properties + 54 projects + 143 units + 11 lead_interests** ใน DB ปัจจุบัน
- **9 Database tables** ที่ใช้งาน
- **6 Modals/Dialogs** ในหน้านี้
- **30+ React states**
- **6 Activity types** ที่ log

### 📁 Related Files
- [src/pages/PropertyManagement.tsx](../src/pages/PropertyManagement.tsx)
- [src/components/properties/CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx)
- [src/components/properties/EditProjectModal.tsx](../src/components/properties/EditProjectModal.tsx)
- [src/components/properties/ProjectsContent.tsx](../src/components/properties/ProjectsContent.tsx)
- [src/components/leads/AddLeadModal.tsx](../src/components/leads/AddLeadModal.tsx)
- [src/components/auth/PermissionGuard.tsx](../src/components/auth/PermissionGuard.tsx)
- [src/components/dashboard/Sidebar.tsx](../src/components/dashboard/Sidebar.tsx)
- [src/components/dashboard/Header.tsx](../src/components/dashboard/Header.tsx)
- [src/lib/supabase.ts](../src/lib/supabase.ts)

---

*รายงานนี้สร้างขึ้นโดย Claude Code (Opus 4.7) เมื่อวันที่ 2026-04-27*
