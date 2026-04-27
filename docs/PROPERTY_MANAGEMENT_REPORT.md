# 📊 รายงานการทำงานของหน้า Property Management

> **URL:** `http://localhost:5173/properties`
> **Source:** [src/pages/PropertyManagement.tsx](../src/pages/PropertyManagement.tsx) (2,096 บรรทัด)
> **อัพเดตล่าสุด:** 2026-04-27 (ฉบับที่ 2 — เขียนใหม่หลังแก้บั๊กและ refactor)
> **Branch:** `001-production-readiness`
> **Latest commit:** `45d81ea` fix(properties): dedupe project list + cleanup duplicate records

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
13. [User Feedback (Toast Notifications)](#13-user-feedback-toast-notifications)
14. [Edge Cases & Error Handling](#14-edge-cases--error-handling)
15. [ปัญหาที่เหลือและข้อเสนอแนะ](#15-ปัญหาที่เหลือและข้อเสนอแนะ)
16. [การเปลี่ยนแปลงล่าสุด (Changelog)](#16-การเปลี่ยนแปลงล่าสุด-changelog)

---

## 1. ภาพรวม (Overview)

หน้า **Property Management** เป็นหน้าจัดการ "โครงการอสังหาริมทรัพย์" และ "ยูนิต" ภายในแต่ละโครงการ
ทำงานบน multi-tenant architecture (แต่ละ tenant เห็นข้อมูลเฉพาะของตัวเอง)

### 🎯 จุดประสงค์หลัก
- **ดู / ค้นหา / กรอง** โครงการอสังหาริมทรัพย์ทั้งหมดของบริษัท
- **สร้าง / แก้ไข / ลบ** โครงการ (Project) เช่น คอนโด, บ้านเดี่ยว, ทาวน์โฮม
- **สร้าง / แก้ไข / ลบ** ยูนิต (Unit) ภายในแต่ละโครงการ
- **ดูสถิติ** ยูนิตที่ว่าง / จอง / ขายแล้ว / มูลค่ารวม
- **เพิ่ม Lead** จากยูนิตที่ลูกค้าสนใจ (เชื่อมโยงกับ Lead Management)
- **ดู Lead** ที่สนใจยูนิตหนึ่งๆ
- **อัปโหลดรูป** ทั้ง thumbnail และ gallery ขึ้น Supabase Storage

### 📊 ปริมาณข้อมูลปัจจุบันใน DB

| Table | จำนวน Records | บทบาท |
|-------|---------------|-------|
| `properties` | **33** | โครงการ (legacy + ใหม่ merged) |
| `projects` | **33** | โครงการ (FK สำหรับ units) |
| `units` | 143 | ยูนิตในโครงการ |
| `lead_interests` | 11 | ความสนใจของ lead ต่อยูนิต |

> 💡 **หมายเหตุ:** ตัวเลขนี้หลังการ cleanup ลบ duplicate records (ก่อนเป็น 52/53)
> มี 2 ตารางสำหรับโครงการ (`properties` และ `projects`) ทำงานคู่กัน — ดูรายละเอียดใน [Section 15](#15-ปัญหาที่เหลือและข้อเสนอแนะ)

---

## 2. สิทธิ์การเข้าถึง (Permissions)

หน้านี้ใช้ Permission Guard 2 ชั้น:

### 🔐 Guard ที่ใช้งาน

| Guard | สิทธิ์ที่ผ่าน | ครอบ |
|-------|--------------|------|
| `ViewPropertiesGuard` | OWNER, ADMIN, SALES | ทั้งหน้า (Read-only views) |
| `ManagePropertiesGuard` | OWNER, ADMIN | ปุ่ม สร้าง / แก้ไข / ลบ (Mutations) |

### 📋 ตารางสิทธิ์ละเอียด

| Action | OWNER | ADMIN | SALES |
|--------|:-----:|:-----:|:-----:|
| ดูรายการโครงการ | ✅ | ✅ | ✅ |
| ดูสถิติโครงการ | ✅ | ✅ | ✅ |
| ดูยูนิตในโครงการ | ✅ | ✅ | ✅ |
| ดูรายละเอียดยูนิต | ✅ | ✅ | ✅ |
| ดู Lead ที่สนใจยูนิต | ✅ | ✅ | ✅ |
| **เพิ่มโครงการใหม่** | ✅ | ✅ | ❌ |
| **แก้ไขโครงการ** | ✅ | ✅ | ❌ |
| **ลบโครงการ** | ✅ | ✅ | ❌ |
| **เพิ่มยูนิตใหม่** | ✅ | ✅ | ❌ |
| **แก้ไขยูนิต** | ✅ | ✅ | ❌ |
| **ลบยูนิต** | ✅ | ✅ | ❌ |
| เพิ่ม Lead จากยูนิต | ✅ | ✅ | ✅ |

### 🛡️ การ Redirect / Fallback
- ผู้ใช้ไม่ได้ login → redirect ไปที่ `/auth/login`
- ผู้ใช้ไม่มี `currentTenant` → แสดงข้อความ "กรุณาเลือกบริษัทก่อน"
- ผู้ใช้ไม่มีสิทธิ์ใดๆ → แสดงข้อความ "การเข้าถึงถูกจำกัด" + icon Lock

---

## 3. โครงสร้างหน้า (Page Structure)

หน้านี้มี **2 View หลัก** ที่ toggle กันด้วย state `selectedProperty`:

```
┌─────────────────────────────────────────────────────┐
│  PropertyManagement.tsx                              │
│                                                      │
│  ┌──────────┐  ┌─────────────────────────────────┐  │
│  │ Sidebar  │  │  Header                         │  │
│  │          │  ├─────────────────────────────────┤  │
│  │ • เมนู    │  │                                 │  │
│  │   ทั้งหมด │  │  ┌───────────────────────────┐  │  │
│  │          │  │  │  View 1: Projects List    │  │  │
│  │          │  │  │  (selectedProperty=null)  │  │  │
│  │          │  │  └───────────────────────────┘  │  │
│  │          │  │                                 │  │
│  │          │  │           OR (toggle)           │  │
│  │          │  │                                 │  │
│  │          │  │  ┌───────────────────────────┐  │  │
│  │          │  │  │  View 2: Units List       │  │  │
│  │          │  │  │  (selectedProperty≠null)  │  │  │
│  │          │  │  └───────────────────────────┘  │  │
│  └──────────┘  └─────────────────────────────────┘  │
│                                                      │
│  Sonner <Toaster /> mounted globally ใน App.tsx    │
└─────────────────────────────────────────────────────┘
```

### 🧩 Components ที่ใช้
- **Layout:** `Sidebar`, `Header` (import โดยตรง — ยังไม่ใช้ DashboardLayout)
- **UI Library:** shadcn/ui (Card, CardHeader, CardTitle, CardContent, CardDescription, Button, Input, Textarea, Badge, Label, Table, Dialog, Select, Tabs, DropdownMenu)
- **Toast Library:** [sonner](https://sonner.emilkowal.ski/) ผ่าน `import { toast } from 'sonner'`
- **External Modal Components:**
  - [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx) — สร้าง/แก้ไขโครงการ
  - [AddLeadModal.tsx](../src/components/leads/AddLeadModal.tsx) — เพิ่ม Lead จากยูนิต

---

## 4. การเชื่อมต่อฐานข้อมูล (Database Integration)

### 📂 ตารางและ Storage Bucket

| Resource | บทบาท | Operations ที่ทำ |
|----------|-------|------------------|
| `properties` (table) | โครงการ (legacy) | SELECT, DELETE |
| `projects` (table) | โครงการ (FK สำหรับ units) | SELECT |
| `units` (table) | ยูนิตในโครงการ | SELECT, INSERT, UPDATE, DELETE |
| `lead_interests` (table) | ความสนใจ lead ต่อยูนิต | SELECT (joined) |
| `customers` (table) | ลูกค้า | SELECT (joined ผ่าน leads) |
| `users` (table) | พนักงานขาย | SELECT (joined ผ่าน leads.assigned_to) |
| `units` (storage bucket) | รูปภาพยูนิต | UPLOAD, GET PUBLIC URL |
| `th_provinces` (table) | จังหวัด | SELECT (ใน CreateProjectModal) |
| `th_districts` (table) | อำเภอ | SELECT |
| `th_sub_districts` (table) | ตำบล | SELECT |
| `zipcodes` (table) | รหัสไปรษณีย์ | SELECT |

> 📝 **Note:** `properties` table มี INSERT/UPDATE ผ่าน [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx) ไม่ได้อยู่ในไฟล์นี้

### 🔄 Queries หลักใน PropertyManagement.tsx

#### 4.1 `fetchProperties()` — ดึงโครงการทั้งหมด ([line 203](../src/pages/PropertyManagement.tsx#L203))
```typescript
// 1. ดึงจาก properties table
.from('properties').select('*').eq('tenant_id', currentTenant?.id)
   .order('created_at', { ascending: false })

// 2. ดึงจาก projects table (มี structure ละเอียดกว่า)
.from('projects').select('*').eq('tenant_id', currentTenant?.id)
   .order('created_at', { ascending: false })

// 3. ⭐ Dedupe by id ด้วย Map (prefer projects entry)
const propertiesMap = new Map<string, Property>();
for (const p of (propertiesData || [])) propertiesMap.set(p.id, p);
for (const p of mappedProjects) propertiesMap.set(p.id, p);
setProperties(Array.from(propertiesMap.values()));
```

> 💡 **Dedupe Logic (เพิ่มในเซสชันนี้):** เนื่องจาก project มักมี id เดียวกันในทั้ง 2 ตาราง การ merge ตรงๆ จะทำให้แสดงซ้ำ — ใช้ Map เพื่อ dedupe โดยเลือก projects entry (มี FK กับ units)

#### 4.2 `fetchUnits(projectId)` — ดึงยูนิตในโครงการ ([line 270](../src/pages/PropertyManagement.tsx#L270))
```typescript
.from('units').select('*')
   .eq('project_id', projectId)
   .order('unit_number', { ascending: true })
```

#### 4.3 `fetchMinPrices(propertyIds)` — ดึงราคาต่ำสุดในแต่ละโครงการ ([line 315](../src/pages/PropertyManagement.tsx#L315))
```typescript
.from('units').select('project_id, price')
   .eq('tenant_id', currentTenant.id)
   .in('project_id', propertyIds)
   .gt('price', 0)
// แล้ว reduce หา min ของแต่ละ project_id
```

#### 4.4 `fetchUnitLeads(unitId)` — ดึง lead ที่สนใจยูนิต ([line 601](../src/pages/PropertyManagement.tsx#L601))
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
.eq('tenant_id', currentTenant?.id)
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

### 📊 KPI Cards (4 ใบ — Plain Card style)

| Card | คำนวณจาก | แสดง subtitle |
|------|---------|--------------|
| **โครงการทั้งหมด** | `properties.length` | จำนวนยูนิตรวม (`projectStats.totalUnits`) |
| **ยูนิตทั้งหมด** | `Σ p.total_units` | จำนวนโครงการ |
| **โครงการที่เปิดขาย** | `properties.filter(p => p.is_active).length` | % ของทั้งหมด |
| **มูลค่ารวม** | `Σ (base_price × total_units)` | "ราคาเริ่มต้น × จำนวนยูนิต" |

> 💡 **UI Style:** ใช้ Plain `<Card><CardHeader><CardTitle><CardContent>` (ผ่านการ surgical merge จาก origin/002 ในเซสชันนี้)

### 🔍 ตัวกรอง (Filters)

| ตัวกรอง | ตัวเลือก | Logic |
|---------|---------|-------|
| **ค้นหาชื่อ** | textbox (`searchQuery`) | `property.name.toLowerCase().includes(query)` |
| **ประเภท** | ทุกประเภท / คอนโด / บ้านเดี่ยว / บ้านแฝด / ทาวน์โฮม / วิลล่า / อพาร์ตเมนท์ / อาคารพาณิชย์ | `property.type === filter` |

### 🎴 Project Cards (Grid 3 columns)

แต่ละ card แสดง:
- **รูป Thumbnail** หรือ icon Building2 (fallback)
- **Badge "แนะนำ"** (ถ้า `is_featured`)
- **Badge ประเภทโครงการ** (มุมขวาบน)
- **ชื่อโครงการ** (line-clamp 1)
- **ที่ตั้ง** (อำเภอ + จังหวัด พร้อม icon MapPin)
- **Stats** (ถ้ามี):
  - จำนวนยูนิต (`total_units`) + icon Home
  - จำนวนชั้น (`floor_count`) + icon Layers
  - ผู้พัฒนา (`developer`) + icon User
- **ราคาเริ่มต้น** (สีเขียว, format ย่อ "X.X ล้านบาท")
  - ใช้ `minPrices[property.id]` ถ้ามี — fallback `property.base_price`
- **Click Action:** เลือกโครงการ → ไป View 2 (`setSelectedProperty(property)`)

### 🔘 ปุ่ม "เพิ่มโครงการใหม่"
- มุมขวาบนของ Header card, gradient violet→purple
- ห่อด้วย `ManagePropertiesGuard`
- เปิด `CreateProjectModal` (mode: create, `editingProperty=null`)

---

## 6. View 2: รายละเอียดยูนิต (Units List)

แสดงเมื่อ `selectedProperty !== null`

### 🔙 ปุ่ม "← กลับไปรายการโครงการ"
- คลิก → `setSelectedProperty(null)` → กลับ View 1

### 📋 Property Info Card
- **ชื่อโครงการ** + **ที่ตั้ง** (อำเภอ + จังหวัด)
- **คำอธิบาย** (description)
- **ปุ่ม "แก้ไข" / "ลบ"** (ห่อด้วย `ManagePropertiesGuard`)

### 📊 Units Stats (4 KPI cards — Plain Card style)

| Card | คำนวณ | subtitle |
|------|-------|---------|
| **ยูนิตทั้งหมด** | `units.length` | - |
| **ว่างขาย** (สีเขียว) | `units.filter(u => u.status === 'available').length` | % ของทั้งหมด |
| **ขายแล้ว** (สีน้ำเงิน) | `units.filter(u => u.status === 'sold').length` | % ของทั้งหมด |
| **มูลค่ารวม** | `Σ unit.price` | - |

### 🔍 Filters

| ตัวกรอง | ตัวเลือก | Logic |
|---------|---------|-------|
| **ค้นหาเลขที่ยูนิต** | textbox (`unitSearchQuery`) ⭐ | `unit.unit_number.toLowerCase().includes(query)` |
| **สถานะ** | ทุกสถานะ / ว่าง / จอง / ขายแล้ว | `unit.status === filter` |

> ⭐ **อัพเดต:** Filter ค้นหายูนิตใช้งานได้แล้ว (เซสชันนี้แก้บั๊ก state binding)

### 📑 Units Table

| Column | Source | Format |
|--------|--------|--------|
| เลขที่ | `unit.unit_number` | bold |
| ชั้น | `unit.floor_number` | "ชั้น X" หรือ "-" |
| ขนาด | `unit.area_sqm` | "X ตร.ม." |
| ห้องนอน/น้ำ | `unit.bedrooms`, `unit.bathrooms` | icon Bed + ตัวเลข, icon Bath + ตัวเลข |
| ราคา | `unit.price` | `formatCurrency()` (THB) |
| สถานะ | `unit.status` | `<Badge>` พร้อม label |
| ดำเนินการ | - | DropdownMenu (`...`) |

### 🔘 Dropdown Actions ในแต่ละแถว

| Action | สิทธิ์ | ทำอะไร |
|--------|--------|---------|
| 👁️ **ดูรายละเอียด** | ทุกคน | เปิด `Unit Detail Dialog` + `fetchUnitLeads(unit.id)` |
| 👤 **เพิ่ม Lead ใหม่** | ทุกคน | เปิด `<AddLeadModal>` พร้อม pre-fill propertyId, unitId |
| ✏️ **แก้ไข** | OWNER, ADMIN | เปิด Unit Dialog (mode: edit) |
| 🗑️ **ลบ** | OWNER, ADMIN | เปิด Delete Confirmation Dialog |

### 🔘 ปุ่ม "เพิ่มยูนิตใหม่"
- มุมขวาบนของ table actions, ห่อด้วย `ManagePropertiesGuard`
- เปิด Unit Dialog (mode: create)

---

## 7. Modals & Dialogs

มีทั้งหมด **6 Modals/Dialogs** ในหน้านี้:

### 7.1 🟣 Create/Edit Project Modal
**Component:** [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx)
**Trigger:** ปุ่ม "เพิ่มโครงการใหม่" หรือ "แก้ไข"
**Mode:** toggle ด้วย `editingProperty` prop (null = create, object = edit)

#### Form Fields (5 sections)
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

#### การ Save (โดย CreateProjectModal เอง)
1. Upload thumbnail / gallery / attachments → Supabase Storage
2. Insert / Update เข้า `properties` table
3. ถ้าเป็น create → Insert เข้า `projects` table ด้วย (id เดียวกัน) เพื่อ FK ของ units
4. Callback `onProjectCreated()` → trigger `fetchProperties()` → ปิด modal

#### Cascading Dropdowns Logic
- เลือกจังหวัด → fetch districts ของจังหวัดนั้น
- เลือกอำเภอ → fetch sub-districts ของอำเภอนั้น
- เลือกตำบล → fetch zipcode อัตโนมัติ
- ใน edit mode: pre-load ทุก level พร้อมกันก่อน setFormData (ป้องกัน cascading reset)

---

### 7.2 🔵 Unit Add/Edit Dialog
**Inline ใน:** [PropertyManagement.tsx:1275](../src/pages/PropertyManagement.tsx#L1275)
**Mode:** toggle ด้วย `editingUnit` state

#### Form Sections (5 sections, สีต่างกัน)
1. **ข้อมูลพื้นฐาน** (Section 1, สีน้ำเงิน) — Card, icon Home
   - เลขที่ยูนิต `*` (required)
   - เลขที่ชั้น
   - ราคา (฿) `*` (required)

2. **รูปภาพยูนิต** (Section 2, สีม่วง) — Card, icon ImageIcon
   - Thumbnail (single) — preview + ปุ่มลบ
   - Gallery (multiple) — grid 5 cols + ปุ่มเพิ่ม/ลบรายตัว

3. **ขนาดพื้นที่** (Section 3, สีเขียว) — Card, icon Ruler
   - พื้นที่ใช้สอย (ตร.ม.)
   - พื้นที่ดิน (ตร.ว.)

4. **จำนวนห้อง** (Section 4, สีส้ม) — Card, icon Bed
   - ห้องนอน
   - ห้องน้ำ
   - จำนวนชั้น

5. **รายละเอียดและสถานะ** (Section 5, สีเทา) — Card, icon FileText
   - ข้อมูลเพิ่มเติม (textarea)
   - สถานะยูนิต (select: available / reserved / sold / unavailable)

#### Footer
- ปุ่ม **ยกเลิก** (กลับโดยไม่บันทึก)
- ปุ่ม **บันทึก/เพิ่มยูนิต** (gradient violet→purple)
  - **disabled** ถ้าไม่กรอก unit_number หรือ price
  - แสดง spinner ระหว่างบันทึก (`savingUnit` state)

#### การ Save (`handleSaveUnit` — [line 361](../src/pages/PropertyManagement.tsx#L361))
1. Upload thumbnail (`uploadUnitImage(file, 'thumbnails')`)
2. Upload gallery images แต่ละไฟล์ (`uploadUnitImage(file, 'gallery')`)
3. INSERT/UPDATE ลง `units` table
4. Activity log: `unit_created` หรือ `unit_updated`
5. **Toast notification:** สำเร็จ → `toast.success(...)`, ผิดพลาด → `toast.error(...)`
6. Refresh units → ปิด dialog

#### Memory Management
- ใช้ `URL.createObjectURL()` สำหรับ preview รูปก่อน upload
- เรียก `URL.revokeObjectURL()` ทุกครั้งที่ลบ/reset เพื่อป้องกัน memory leak

---

### 7.3 🟦 Unit Detail Dialog
**Inline ใน:** [PropertyManagement.tsx:1719](../src/pages/PropertyManagement.tsx#L1719)
**Trigger:** เลือก "ดูรายละเอียด" จาก dropdown
**State trigger:** `showUnitDetailDialog`, `viewingUnit`, `unitLeads`

แสดง:
- **ข้อมูลยูนิต** ครบถ้วน (เลขที่, ชั้น, พื้นที่, ราคา, ห้อง, สถานะ ฯลฯ)
- **Gallery รูปภาพ** ของยูนิต
- **รายการ Lead ที่สนใจยูนิตนี้** (ดึงจาก `fetchUnitLeads(unitId)`)
  - แสดง: ชื่อลูกค้า, สถานะ lead, แหล่งที่มา, พนักงานขายที่ดูแล, วันที่สร้าง

---

### 7.4 🔴 Delete Project Confirmation Dialog
**Inline ใน:** [PropertyManagement.tsx:1648](../src/pages/PropertyManagement.tsx#L1648)
**Trigger:** ปุ่ม "ลบ" ใน Property Info Card (View 2)

- Header: gradient ม่วง + icon AlertTriangle (สีขาว)
- Title: "ยืนยันการลบโครงการ"
- Message: "คุณแน่ใจหรือไม่ว่าต้องการลบโครงการ '${selectedProperty.name}'?"
- ปุ่ม: **ยกเลิก** (outline) / **ยืนยันการลบ** (destructive variant)

#### การลบ (`handleDeleteProperty` — [line 471](../src/pages/PropertyManagement.tsx#L471))
1. DELETE จาก `properties` table
2. Activity log: `property_deleted`
3. **Toast notification:** สำเร็จ → `toast.success('ลบโครงการ "X" สำเร็จ')`, ผิดพลาด → `toast.error(...)`
4. Refresh properties → ปิด dialog

⚠️ **Cascade Behavior:** ลบจาก `properties` เท่านั้น — `projects` table และ `units` ที่ FK ไปที่ `projects.id` จะกลายเป็น orphan (รอแก้ใน [Section 15](#15-ปัญหาที่เหลือและข้อเสนอแนะ))

---

### 7.5 🔴 Delete Unit Confirmation Dialog
**Inline ใน:** PropertyManagement.tsx
**Trigger:** เลือก "ลบ" จาก dropdown ในแถวยูนิต

#### การลบ (`handleDeleteUnit` — [line 674](../src/pages/PropertyManagement.tsx#L674))
1. DELETE จาก `units` table
2. Activity log: `unit_deleted`
3. **Toast notification:** สำเร็จ → `toast.success('ลบยูนิต X สำเร็จ')`, ผิดพลาด → `toast.error(...)`
4. Refresh units → ปิด dialog

---

### 7.6 🟢 Add Lead Modal
**Component:** [AddLeadModal.tsx](../src/components/leads/AddLeadModal.tsx)
**Trigger:** เลือก "เพิ่ม Lead ใหม่" จาก dropdown ในแถวยูนิต
**Pre-filled props:** `propertyId`, `propertyName`, `unitId`, `unitNumber`

- เมื่อสร้าง lead สำเร็จ → callback `handleLeadCreated()` → navigate ไป `/leads`

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

### 🔄 Upload Function: `uploadUnitImage(file, folder)`  ([line 720](../src/pages/PropertyManagement.tsx#L720))
1. สร้าง file path ที่ unique: `{tenant_id}/{project_id}/{folder}/{timestamp}-{random}.{ext}`
2. Upload ด้วย `supabase.storage.from('units').upload(path, file, { cacheControl: '3600', upsert: false })`
3. ดึง public URL ด้วย `supabase.storage.from('units').getPublicUrl(path)`
4. Return URL หรือ `null` ถ้าผิดพลาด

### 🖼️ การแสดงผล
- ใช้ `URL.createObjectURL()` สำหรับ preview ก่อน upload
- หลัง save: ดึงจาก `images[]` array ใน DB record (`unit.images`)

---

## 9. Activity Logging

ทุกการกระทำสำคัญ log ผ่าน `supabase.rpc('log_activity', {...})`

### 📝 Activities ที่บันทึกใน PropertyManagement.tsx (4 ประเภท)

| Action | activity_type | Description format |
|--------|---------------|---------------------|
| สร้างยูนิต | `unit_created` | `สร้างยูนิตใหม่: {unit_number} ({project_name})` |
| แก้ไขยูนิต | `unit_updated` | `แก้ไขยูนิต: {unit_number} ({project_name})` |
| ลบยูนิต | `unit_deleted` | `ลบยูนิต: {unit_number} ({project_name})` |
| ลบโครงการ | `property_deleted` | `ลบโครงการ: {name}` |

> 📝 **Note:** `property_created` / `property_updated` ถูก log ใน [CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx) แทน (ไม่อยู่ในไฟล์นี้)

### 📦 Metadata ที่ log
ทุก action จะแนบ metadata:
- `property_id`, `project_id`, `unit_id`
- `property_name`, `project_name`, `unit_number`
- `type` (project type)
- `status` (สำหรับ unit)

### 🛡️ Error Handling
ทุก log ห่อด้วย `try/catch` แยก — ถ้า log ผิดพลาดจะถูก ignore ไม่ block flow หลัก

---

## 10. State Management

ใช้ React `useState` ทั้งหมด (no Redux/Zustand) — รวม **25 states**

### 📋 Categories ของ State

#### 10.1 Data States (5)
- `properties` — list ของโครงการ (Property[])
- `selectedProperty` — โครงการที่เลือก (null = แสดง list, object = แสดง units)
- `units` — list ของยูนิตในโครงการที่เลือก (Unit[])
- `unitLeads` — leads ที่สนใจยูนิต (any[])
- `minPrices` — Map ของ project_id → ราคาต่ำสุด

#### 10.2 UI States (3)
- `loading` — กำลังโหลด properties
- `savingUnit` — กำลังบันทึกยูนิต (แสดง spinner)
- `sidebarOpen` — sidebar mobile

#### 10.3 Filter / Search States (4)
- `searchQuery` — ค้นหาชื่อโครงการ
- `unitSearchQuery` ⭐ — ค้นหาเลขที่ยูนิต (เพิ่มในเซสชันนี้)
- `typeFilter` — กรองประเภทโครงการ
- `statusFilter` — กรองสถานะยูนิต

#### 10.4 Dialog States (6)
- `showPropertyDialog` — Create/Edit Project Modal
- `showUnitDialog` — Unit Add/Edit Dialog
- `showDeleteDialog` — Delete Project Confirmation
- `showUnitDetailDialog` — Unit Detail Dialog
- `showDeleteUnitDialog` — Delete Unit Confirmation
- `showAddLeadModal` — Add Lead Modal

#### 10.5 Editing States (5)
- `editingProperty` — โครงการที่กำลังแก้
- `editingUnit` — ยูนิตที่กำลังแก้
- `viewingUnit` — ยูนิตที่กำลังดู
- `deletingUnit` — ยูนิตที่กำลังจะลบ
- `selectedUnitForLead` — ยูนิตที่จะใช้สร้าง lead

#### 10.6 Form States (1)
- `unitForm` — object สำหรับ form ยูนิต (12 fields)

> ⭐ **อัพเดต:** ลบ `propertyForm` (legacy dead code) ออกแล้ว — CreateProjectModal จัดการ form เองทั้งหมด

---

## 11. Helper Functions

### 11.1 `formatPriceShort(amount)` ([line 346](../src/pages/PropertyManagement.tsx#L346))
แปลงราคาเป็นรูปย่อ:
- `≥ 1,000,000` → `"X.X ล้านบาท"`
- `≥ 1,000` → `"X พันบาท"`
- `< 1,000` → `"X บาท"`
- `null/0` → `"-"`

### 11.2 `formatCurrency(amount)` ([line 752](../src/pages/PropertyManagement.tsx#L752))
ใช้ `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 })`
ตัวอย่าง: `formatCurrency(2500000)` → `"฿2,500,000"`

### 11.3 `getPropertyTypeLabel(type)` ([line 727](../src/pages/PropertyManagement.tsx#L727))
แปลง code → ชื่อภาษาไทย:
- `apartment` → "อพาร์ตเมนท์"
- `single_house` / `house` → "บ้านเดี่ยว"
- `twin_house` → "บ้านแฝด"
- `townhome` → "ทาวน์โฮม"
- `villa` → "วิลล่า"
- `condo` → "คอนโด"
- `commercial` → "อาคารพาณิชย์"

### 11.4 `getUnitStatusBadge(status)` ([line 741](../src/pages/PropertyManagement.tsx#L741))
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

### 11.6 Filtered Data
- `filteredProperties` ([line 760](../src/pages/PropertyManagement.tsx#L760)) — กรองด้วย `searchQuery` + `typeFilter`
- `filteredUnits` ([line 766](../src/pages/PropertyManagement.tsx#L766)) — กรองด้วย `unitSearchQuery` + `statusFilter` ⭐

---

## 12. การ Validate ข้อมูล

### ✅ Form-level Validation
- **Project Form** (CreateProjectModal):
  - `name` required
  - `project_type` required
- **Unit Form** (Unit Dialog):
  - `unit_number` required
  - `price` required
  - ปุ่ม Save จะ disabled ถ้าทั้งสองไม่ครบ

### ⚠️ การ Parsing
- `parseFloat()` สำหรับ price, area
- `parseInt()` สำหรับ floor, bedrooms, bathrooms, floor_count
- `null` ถ้า field ว่าง (สำหรับ optional numerics)

### ❌ Server-side Validation
ไม่มีในโค้ด frontend — พึ่งพา DB constraint และ RLS ของ Supabase

---

## 13. User Feedback (Toast Notifications)

ใช้ **sonner** สำหรับ toast (mounted ใน App.tsx)

### 🔔 Toast Calls ในไฟล์นี้ (6 จุด)

| Handler | Success | Error |
|---------|---------|-------|
| `handleSaveUnit` ([line 454](../src/pages/PropertyManagement.tsx#L454)) | "เพิ่ม/แก้ไขยูนิต X สำเร็จ" | "เกิดข้อผิดพลาดในการบันทึกยูนิต" |
| `handleDeleteProperty` ([line 490](../src/pages/PropertyManagement.tsx#L490)) | "ลบโครงการ \"X\" สำเร็จ" | "เกิดข้อผิดพลาดในการลบโครงการ" |
| `handleDeleteUnit` ([line 699](../src/pages/PropertyManagement.tsx#L699)) | "ลบยูนิต X สำเร็จ" | "เกิดข้อผิดพลาดในการลบยูนิต" |

> ⭐ **อัพเดต:** เพิ่มในเซสชันนี้แทนการใช้ `alert()` หรือเงียบที่ console.error

---

## 14. Edge Cases & Error Handling

### 🔄 Edge Cases ที่ Handle

| Case | Behavior |
|------|----------|
| ไม่มี `currentTenant` | แสดงหน้า "กรุณาเลือกบริษัทก่อน" |
| `properties` ว่าง | แสดง "ไม่พบโครงการ" + icon Building2 |
| `units` ว่าง | แสดง "ไม่พบยูนิต" ในแถว table |
| ไม่มี `thumbnail_url` | แสดง icon Building2 fallback |
| ราคา = 0 | แสดง `"-"` (จาก `formatPriceShort`) |
| `floor_number` = null | แสดง `"-"` |
| `area_sqm` = null | แสดง `"-"` |
| Image upload error | log + return null (ไม่ crash) |
| log_activity error | catch + ignore (ไม่ block flow) |
| Cross-table duplicate id | ⭐ Dedupe ด้วย Map (เพิ่มในเซสชันนี้) |

### ❗ Error Handling
- ทุก `async` function ห่อด้วย `try/catch`
- ใช้ `toast.error()` แสดง error ให้ user เห็น (ไม่ใช่แค่ console.error)
- ใช้ `console.error()` เป็นทาง log สำหรับ debugging

---

## 15. ปัญหาที่เหลือและข้อเสนอแนะ

### 🚨 ปัญหาที่ยังเหลือ

#### 15.1 ⚠️ ตาราง `properties` กับ `projects` ทำงานคู่กัน — Architectural Issue
- เมื่อสร้างโครงการใหม่ → insert ทั้ง `properties` และ `projects` ที่ id เดียวกัน
- เมื่อ fetch → query ทั้ง 2 ตาราง แล้ว merge (ตอนนี้ dedupe ด้วย Map แล้ว)
- **สาเหตุ:** FK ของ `units` ชี้ไปที่ `projects.id` ไม่ใช่ `properties.id`
- **ผลกระทบ:** Race condition ถ้า insert / update / delete 2 ตารางไม่ atomic
- **แนะนำ:** Refactor ใช้ตารางเดียว (ใหญ่ — งาน database migration)

#### 15.2 ⚠️ การลบโครงการไม่ลบ Units และ Projects record
- `handleDeleteProperty` ลบจาก `properties` table อย่างเดียว
- ยูนิตที่ FK ไปที่ `projects` table จะกลายเป็น orphan
- `projects` table ก็ไม่ถูกลบด้วย
- **แนะนำ:** เพิ่ม cascade delete ใน DB หรือ delete projects + units ก่อน

#### 15.3 ⚠️ Sidebar pattern เก่า (ไม่ใช่ DashboardLayout)
- หน้านี้ import Sidebar/Header เอง — ยังไม่ได้ migrate เข้า DashboardLayout
- ทำให้ sidebar state แยก ไม่สอดคล้องกับ pattern ใหม่ที่ใช้ใน /analytics และ /api

#### 15.4 ⚠️ State มี 25 ตัว — ควรย่อยเป็น custom hooks
ตัวอย่าง:
- `useProperties()` — จัดการ properties + units
- `useUnitForm()` — จัดการ unit form

#### 15.5 ⚠️ Dialog logic ผูกอยู่ในไฟล์เดียวกัน 2,096 บรรทัด
- Unit Dialog ขนาด ~300 บรรทัดควรแยกเป็น `<UnitFormModal />`
- Detail Dialog ก็ควรแยก

### ✅ ปัญหาที่แก้ไปแล้วในเซสชันนี้

| ปัญหา | สถานะ | Commit |
|------|------|--------|
| ตัวกรอง "ค้นหาเลขที่ยูนิต" ไม่ทำงาน | ✅ แก้แล้ว | `faba006` |
| ไม่มี Toast Notification | ✅ แก้แล้ว | `faba006` |
| Property Save Error เงียบ | ✅ แก้แล้ว (handleSaveProperty ลบ) | `faba006` |
| Dead code (propertyForm) | ✅ ลบแล้ว | `faba006` |
| Cross-table duplication (105 cards) | ✅ แก้ด้วย Map dedupe | `45d81ea` |
| DB duplicate records (19 ชื่อซ้ำ) | ✅ Cleanup script ลบไปแล้ว 20 records | `45d81ea` |

### 💡 ข้อเสนอแนะที่เหลือ

| # | ข้อเสนอ | ความสำคัญ |
|---|---------|----------|
| 1 | Refactor properties / projects → ตารางเดียว | 🔴 High |
| 2 | เพิ่ม cascade delete (projects + units) | 🟡 Medium |
| 3 | Migrate ไปใช้ DashboardLayout | 🟢 Low |
| 4 | แยก components ย่อย (UnitFormModal, UnitDetailDialog) | 🟢 Low |
| 5 | เพิ่ม pagination ใน units table | 🟢 Low |
| 6 | เพิ่ม sort columns | 🟢 Low |
| 7 | เพิ่ม bulk actions (multi-select) | 🟢 Low |
| 8 | ตั้ง schedule run cleanup-property-duplicates.cjs ป้องกัน duplicates | 🟢 Low |

---

## 16. การเปลี่ยนแปลงล่าสุด (Changelog)

### 📅 2026-04-27 — Quick Wins + Surgical Merge + Dedupe Fix

#### Commit `faba006` — Quick Wins + Surgical UI Merge
- เพิ่ม `unitSearchQuery` state — search ยูนิตทำงานได้
- เพิ่ม Toast notifications ใน 3 handlers
- ลบ dead code (`propertyForm`, `handleSaveProperty`, `resetPropertyForm`)
- Surgical UI: Stats Cards เปลี่ยนเป็น plain Card style จาก `origin/002-production-readiness`
- เก็บ Lead integration จาก feature/multi-role (fetchUnitLeads, AddLeadModal)

#### Commit `45d81ea` — Dedupe Fix (Code + Data)
- **Code:** เพิ่ม Map dedupe ใน `fetchProperties()`
- **Data:** สร้าง `scripts/cleanup-property-duplicates.cjs` พร้อม auto-backup
- ลบ duplicate records 19 + 1 IDEO MOBI orphan
- Cards user เห็น: 105 → 33

---

## 📌 สรุป

หน้า Property Management เป็นหน้า**ที่ใช้งานข้อมูลจริงทั้งหมด** ดึงจาก Supabase DB แบบ real-time ไม่มี mock data
มีฟีเจอร์ครบถ้วน:
- ✅ CRUD โครงการ (ผ่าน CreateProjectModal)
- ✅ CRUD ยูนิต (พร้อม image upload)
- ✅ Search + Filter ทั้ง 2 view
- ✅ Lead Integration (Add Lead จากยูนิต, View Leads ที่สนใจ)
- ✅ Activity Logging
- ✅ Toast Notifications
- ✅ Permission Guards (3-role system)

แต่ยังมีปัญหาทาง architecture (2-table model) ที่ควร refactor ในระยะยาว

### 🔢 ตัวเลขสำคัญ
- **2,096 บรรทัด** ในไฟล์ PropertyManagement.tsx
- **33 properties + 33 projects + 143 units + 11 lead_interests** ใน DB
- **11 Database resources** (10 tables + 1 storage bucket)
- **6 Modals/Dialogs**
- **25 React states**
- **4 Activity types** (logged ในไฟล์นี้)
- **6 Toast notifications**
- **1 Permission Guard ชั้นนอก** (ViewPropertiesGuard) + **1 ชั้นใน** (ManagePropertiesGuard)

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
- [scripts/cleanup-property-duplicates.cjs](../scripts/cleanup-property-duplicates.cjs)

---

*รายงานนี้ฉบับที่ 2 สร้างขึ้นโดย Claude Code (Opus 4.7) เมื่อ 2026-04-27 หลังการแก้บั๊กและ refactor ในเซสชันเดียวกัน*
