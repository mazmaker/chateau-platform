# 🧪 Property Management — Comprehensive E2E Test Prompt (v2)

> **วัตถุประสงค์:** Prompt สำหรับสั่งให้ Claude AI ทดสอบหน้า `/properties` แบบครอบคลุมทุกฟังก์ชัน 100% ตาม
> [PROPERTY_MANAGEMENT_REPORT.md](./PROPERTY_MANAGEMENT_REPORT.md) ผ่าน Playwright MCP
> **เป้าหมาย:** ~205 test cases ครอบคลุมทั้ง 16 sections ของรายงาน

---

## 📋 วิธีใช้

1. เปิด Claude Code ในโปรเจคนี้
2. Copy ส่วน "🤖 PROMPT START" → "🤖 PROMPT END" → paste เป็น message แรก
3. รอ Claude AI ทำงาน (ใช้เวลาประมาณ 2-4 ชั่วโมง)
4. ดูผลลัพธ์ที่ `docs/PROPERTY_MANAGEMENT_TEST_RESULTS.md`

---

## 🤖 PROMPT START

```
คุณคือ QA Engineer Senior ที่ต้องทดสอบหน้า /properties ของ CHATEAU Platform แบบ E2E
ครอบคลุม 100% ผ่าน UI ด้วย Playwright MCP

อ่าน documents เหล่านี้ก่อนเริ่มงาน:
1. docs/PROPERTY_MANAGEMENT_REPORT.md — ข้อมูลครบทุกฟังก์ชันของหน้านี้
2. src/pages/PropertyManagement.tsx — source code หลัก
3. src/components/properties/CreateProjectModal.tsx — modal สร้าง/แก้โครงการ
4. src/components/auth/PermissionGuard.tsx — ระบบสิทธิ์ 3 roles
5. src/lib/supabase.ts — Supabase client config
```

### 🎯 Mission

ทดสอบ **205 test cases** แบ่งเป็น 15 categories ครอบคลุมทุก section ของรายงาน
- ครอบคลุมทั้ง **happy path** และ **edge cases**
- ทดสอบเฉพาะผ่าน UI Playwright (ห้ามแก้ DB โดยตรง)
- Supabase MCP **อนุญาตเฉพาะ read** เพื่อ verify (ห้าม INSERT/UPDATE/DELETE)
- ถ้า FAIL → วิเคราะห์ → แก้ code → ทดสอบซ้ำจนผ่าน
- สร้างรายงาน `docs/PROPERTY_MANAGEMENT_TEST_RESULTS.md`

---

### 🔧 Pre-flight Checklist

1. **Branch:** บน `001-production-readiness`
2. **Dev server:** `http://localhost:5173/` ตอบสนอง (ถ้าไม่มีรัน `npm run dev` background)
3. **Login credentials:**
   | Role | Email | Password | Status |
   |------|-------|----------|--------|
   | OWNER | (need to find/reset) | - | 🟡 |
   | ADMIN | `sales@chateau.com` | `Admin@2026!` | ✅ Verified |
   | SALES | (need to create) | - | 🟡 |

   ถ้า OWNER/SALES ยังไม่มี: ใช้ `scripts/list-admins.cjs` ดูรายชื่อ และ `scripts/reset-admin-password.cjs` รีเซ็ตรหัส (เพื่อ login เท่านั้น — ไม่ใช่แก้ data)

4. **MCP servers:** Playwright + Supabase พร้อม
5. **Browser:** ถ้า Playwright ค้าง → `browser_close` แล้ว navigate ใหม่
6. **Tenant ID:** `00000000-0000-0000-0000-000000000001`

---

### 🛠️ Test Methodology

#### กฎเหล็ก
- 🔴 **ห้าม**: `execute_sql` write, `apply_migration`, run `cleanup-property-duplicates.cjs --execute`
- 🟢 **อนุญาต**:
  - Playwright UI testing (ทุกอย่าง)
  - Supabase MCP read-only (`list_tables`, `get_logs`, head=true counts)
  - Read source code
  - แก้ source code ใน `src/` เพื่อ fix bug
  - สร้าง test data ผ่าน UI (ห้ามผ่าน script)

#### Per Test Case
1. ปฏิบัติตาม Steps
2. Screenshot ที่จุดสำคัญ
3. Verify Expected Result
4. บันทึก PASS / FAIL พร้อม evidence

#### Test Data Hygiene
- ใช้ prefix `[TEST]` ในทุกชื่อที่สร้าง
- Cleanup ทุก `[TEST]` records ผ่าน UI หลัง test เสร็จ

---

### 📋 Test Cases (รวม 205 cases)

#### 🔐 A. Authentication & Permissions (30 cases)

##### A.1 Login Flow (8 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **A1** | Login as ADMIN works | 1. `/auth/login`<br>2. Fill `sales@chateau.com` / `Admin@2026!`<br>3. Click "เข้าสู่ระบบ" | Redirect `/`, Avatar+name "อธิตยา ขายเก่ง", role "Admin" |
| **A2** | Login wrong password shows error | Fill correct email + wrong password | Error message visible, no redirect |
| **A3** | Login wrong email shows error | Fill non-existent email | Error message visible |
| **A4** | Empty fields blocks submit | Click submit without filling | Browser/form validation triggers |
| **A5** | Logout clears session | Login → click avatar → Logout | Redirect `/auth/login` |
| **A6** | Already logged in redirects | Logged in → navigate `/auth/login` | Redirect `/` |
| **A7** | Show password toggle works | Click 👁️ icon next to password | Password becomes visible |
| **A8** | Login as OWNER (if available) | Login with OWNER credentials | Different sidebar items appear |

##### A.2 Page Access (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **A9** | Unauthenticated redirects | Logout → navigate `/properties` | Redirect `/auth/login` |
| **A10** | No tenant fallback | Find user with no tenant → login → `/properties` | "กรุณาเลือกบริษัทก่อน" + icon Building2 |
| **A11** | Sidebar highlights "โครงการ" | A1 done → `/properties` | Sidebar item active |
| **A12** | Page title correct | `/properties` | Heading "โครงการ" + description |

##### A.3 ADMIN Permission Visibility (6 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **A13** | "เพิ่มโครงการใหม่" button visible | Login as ADMIN → `/properties` | Button visible top right |
| **A14** | "แก้ไข"/"ลบ" project buttons visible | Click project → View 2 | 2 buttons visible (right of property info) |
| **A15** | "เพิ่มยูนิตใหม่" button visible | View 2 done | Button visible |
| **A16** | Unit dropdown "แก้ไข"/"ลบ" visible | Click "..." in unit row | 4 menu items visible (รายละเอียด, Lead, แก้ไข, ลบ) |
| **A17** | All 4 KPI cards visible | View 1 | 4 cards |
| **A18** | All 4 unit stats visible | View 2 | 4 cards |

##### A.4 SALES Permission Visibility (6 cases) — Skip if no SALES user available

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **A19** | "เพิ่มโครงการใหม่" hidden for SALES | Login as SALES → `/properties` | Button NOT visible |
| **A20** | "แก้ไข"/"ลบ" project hidden | View 2 | Both buttons NOT visible |
| **A21** | "เพิ่มยูนิตใหม่" hidden | View 2 | Button NOT visible |
| **A22** | Unit dropdown shows only View+Lead | Click "..." in unit row | Only "ดูรายละเอียด" + "เพิ่ม Lead ใหม่" visible (no Edit/Delete) |
| **A23** | Read-only data visible | View 1+2 | Cards/units visible normally |
| **A24** | "เพิ่ม Lead" still works | Click dropdown → "เพิ่ม Lead ใหม่" | AddLeadModal opens |

##### A.5 OWNER Permission Visibility (6 cases) — Skip if no OWNER user

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **A25** | All ADMIN buttons visible for OWNER | Login as OWNER → repeat A13-A18 | All visible |
| **A26-A30** | Same as ADMIN | Repeat A14-A18 | Same expectations |

#### 📋 B. View 1: Projects List (18 cases)

##### B.1 KPI Cards (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **B1** | KPI #1 = properties.length | View 1 | Card "โครงการทั้งหมด" shows correct count (verify via Supabase MCP read `count`) |
| **B2** | KPI #2 = sum of total_units | View 1 | Card "ยูนิตทั้งหมด" shows correct sum |
| **B3** | KPI #3 = active count | View 1 | Card "โครงการที่เปิดขาย" shows count + % |
| **B4** | KPI #4 = total value | View 1 | Card "มูลค่ารวม" shows ฿ amount |

##### B.2 Search Filter (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **B5** | Search exact name | Type "FORESTIAS" | Show matching results |
| **B6** | Search case-insensitive | Type "forestias" | Same result as B5 |
| **B7** | Search partial match | Type "FOR" | Show all matching projects |
| **B8** | No match shows empty state | Type "xxxnoresult" | "ไม่พบโครงการ" + icon |
| **B9** | Clear search returns all | Type "xxx" → clear | All projects visible |

##### B.3 Type Filter (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **B10** | Default "ทุกประเภท" | View 1 | All projects visible |
| **B11** | Filter "คอนโด" | Select "คอนโด" | Only condo projects |
| **B12** | Filter "บ้านเดี่ยว" | Select "บ้านเดี่ยว" | single_house + house projects |
| **B13** | Filter "ทาวน์โฮม" | Select "ทาวน์โฮม" | Only townhome projects |
| **B14** | Combined filter | Search "BAAN" + filter "บ้านเดี่ยว" | AND condition applied |

##### B.4 Project Card Display (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **B15** | Card with thumbnail | Find project with thumbnail_url | Image visible (not icon) |
| **B16** | Card without thumbnail (fallback) | Find project without thumbnail | Building2 icon as fallback |
| **B17** | Featured badge appears | Find project with is_featured=true | Yellow "แนะนำ" badge top-left |
| **B18** | Type badge appears | Any project | Badge top-right showing type label |

#### 📋 C. View 2: Units List (18 cases)

##### C.1 Property Info Card (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **C1** | Display project name | Click project | Title = project name |
| **C2** | Display address | C1 done | Address line with MapPin icon |
| **C3** | Display description | C1 done | Description text below |
| **C4** | Edit/Delete buttons (ADMIN) | C1 done as ADMIN | Both buttons visible |

##### C.2 Units Stats KPI (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **C5** | KPI ยูนิตทั้งหมด = units.length | C1 done | Show count |
| **C6** | KPI ว่างขาย + % | Same | Count + % of total |
| **C7** | KPI ขายแล้ว + % | Same | Count + % of total |
| **C8** | KPI มูลค่ารวม | Same | ฿ formatted |

##### C.3 Search & Filter Units (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **C9** | Search exact unit_number | Type "12/143" | Only that unit |
| **C10** | Search partial | Type "12" | All units with "12" |
| **C11** | Filter "ว่าง" | Select status | Only available units |
| **C12** | Filter "จอง" | Select reserved | Only reserved units |
| **C13** | Filter "ขายแล้ว" | Select sold | Only sold units |

##### C.4 Units Table (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **C14** | All 7 columns visible | View units table | เลขที่, ชั้น, ขนาด, ห้อง, ราคา, สถานะ, ดำเนินการ |
| **C15** | Status badge variants | Find units with different status | 4 variants colored differently |
| **C16** | Empty state "ไม่พบยูนิต" | Filter เน้นหนัก หรือ project ที่ไม่มี units | Show empty message |
| **C17** | Sort by unit_number | Default sort | Units in ascending order |
| **C18** | Pagination (if any) | Project with many units | Smooth scroll or pagination |

##### C.5 Navigation (1 case)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **C19** | Back button works | Click "← กลับไปรายการโครงการ" | Return to View 1, selectedProperty=null |

#### 🟣 D. CreateProjectModal (30 cases)

##### D.1 Open & Layout (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D1** | Open from "เพิ่มโครงการใหม่" | Click button (ADMIN) | Modal opens, title "เพิ่มโครงการ" |
| **D2** | Open from "แก้ไข" (edit mode) | Click "แก้ไข" on existing | Modal opens with pre-filled data |
| **D3** | All sections render | D1 done | 5 sections visible (basic, location, images, links, attachments, status) |
| **D4** | Close button works | Click X | Modal closes without saving |
| **D5** | Backdrop click closes | Click outside modal | Modal closes |

##### D.2 Required Fields Validation (6 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D6** | name required | D1 → leave name empty → Save | Error/disabled |
| **D7** | project_type required | D1 → leave type empty → Save | Error/disabled |
| **D8** | Save disabled with empty required | D1 → empty name+type | Save button disabled |
| **D9** | Save enabled when filled | D1 → fill name+type | Save button enabled |
| **D10** | Whitespace name fails | D1 → name = "   " | Validation rejects |
| **D11** | Very long name (>200 chars) | Fill 250-char name | Either truncates or errors |

##### D.3 Optional Fields (6 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D12** | total_units accepts number | Fill "100" | Value accepted |
| **D13** | floor_count accepts number | Fill "30" | Value accepted |
| **D14** | has_facilities yes/no | Click "yes" | Radio selected |
| **D15** | developer accepts text | Fill "Sansiri" | Value accepted |
| **D16** | address accepts text | Fill long address | Value accepted |
| **D17** | postal_code auto-fills (later test) | (covered in D21) | - |

##### D.4 Cascading Dropdowns (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D18** | Province loads on modal open | D1 → check จังหวัด dropdown | Has 77 จังหวัด |
| **D19** | District loads on province select | Select "กรุงเทพ" | อำเภอ dropdown populated |
| **D20** | Sub-district loads on district | Select an อำเภอ | ตำบล dropdown populated |
| **D21** | Zipcode auto-fills | Select ตำบล | รหัสไปรษณีย์ filled |

##### D.5 Image & Attachments (3 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D22** | Thumbnail upload preview | Click upload → select PNG | Preview visible, X button visible |
| **D23** | Gallery upload (multiple) | Upload 3 images | All 3 previews visible |
| **D24** | Attachment upload | Upload PDF/file | File listed |

##### D.6 URLs (3 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D25** | Sale Kit URL accepts URL | Fill `https://example.com/kit.pdf` | Accepted |
| **D26** | Fact Sheet URL accepts | Fill URL | Accepted |
| **D27** | ROI Calculator URL accepts | Fill URL | Accepted |

##### D.7 Save & Edit (3 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **D28** | Create new project saves | Fill name "[TEST] Project" + type → Save | Modal closes, list refreshed, project visible |
| **D29** | Edit pre-fills all fields | D2 done | Every field populated correctly |
| **D30** | Edit update saves | Change name → Save | List shows updated name |

#### 🔴 E. Delete Project Confirmation (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **E1** | Open Delete Dialog | View 2 → Click "ลบ" | Confirmation dialog opens |
| **E2** | Header gradient + icon | E1 done | Purple gradient + AlertTriangle icon |
| **E3** | Cancel doesn't delete | E1 → Cancel | Dialog closes, project still in list |
| **E4** | Confirm deletes + Toast | E1 → Confirm | Toast "ลบโครงการ X สำเร็จ", redirect View 1, list refreshed |
| **E5** | Cleanup [TEST] project | After D28 → delete | Verify removed |

#### 🔵 F. Unit Add/Edit Dialog (20 cases)

##### F.1 Open & Layout (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **F1** | Open from "เพิ่มยูนิตใหม่" | Click button | Dialog opens |
| **F2** | Open from "แก้ไข" dropdown | Click "..." → Edit | Dialog with pre-filled data |
| **F3** | 5 sections visible | F1 done | All 5 colored sections render |
| **F4** | Section colors correct | F3 done | Blue/Purple/Green/Orange/Gray |
| **F5** | Close button works | Click X | Dialog closes |

##### F.2 Section 1: ข้อมูลพื้นฐาน (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **F6** | unit_number required | F1 → fill price only | Save disabled |
| **F7** | floor accepts number | Fill "15" | Accepted |
| **F8** | price required | F1 → fill unit_number only | Save disabled |
| **F9** | Save enabled with both required | Fill unit+price | Save enabled |
| **F10** | unit_number accepts strings like "A-101" | Fill "[TEST]-001" | Accepted |

##### F.3 Section 3: ขนาดพื้นที่ (3 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **F11** | area_sqm accepts decimal | Fill "45.5" | Accepted |
| **F12** | land_area_sqw accepts decimal | Fill "50" | Accepted |
| **F13** | Both optional | Leave empty + save | Save works |

##### F.4 Section 4: จำนวนห้อง (3 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **F14** | bedrooms accepts number | Fill "2" | Accepted |
| **F15** | bathrooms accepts number | Fill "2" | Accepted |
| **F16** | floor_count accepts number | Fill "2" | Accepted |

##### F.5 Section 5: รายละเอียด & สถานะ (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **F17** | description textarea works | Fill long text | Textarea grows |
| **F18** | status select shows 4 options | Click status dropdown | available/reserved/sold/unavailable |
| **F19** | Status icon colors visible | Each option | Green/Yellow/Blue/Gray dots |
| **F20** | Default status = available | F1 done | "ว่าง" selected by default |

#### 🔵 G. Unit Save & Delete (8 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **G1** | Add unit + Toast | Fill required → Save | Toast "เพิ่มยูนิต ... สำเร็จ", table refreshed |
| **G2** | Edit unit pre-fills | Click Edit on existing | All fields populated |
| **G3** | Update unit + Toast | Change price → Save | Toast "แก้ไขยูนิต ... สำเร็จ" |
| **G4** | Save spinner appears | Click Save | Spinner visible during request |
| **G5** | Delete unit confirmation | Click "ลบ" in dropdown | Confirmation dialog |
| **G6** | Cancel delete | Cancel | Dialog closes, unit remains |
| **G7** | Confirm delete + Toast | Confirm | Toast "ลบยูนิต ... สำเร็จ", table refreshed |
| **G8** | Cleanup [TEST] unit | After G1 | Delete via UI |

#### 🟦 H. Unit Detail Dialog (8 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **H1** | Open from "ดูรายละเอียด" | Click "..." → "ดูรายละเอียด" | Dialog opens |
| **H2** | Display unit info | H1 done | Number, floor, area, bedrooms, bathrooms, price, status |
| **H3** | Display gallery (if has) | H1 done with unit ที่มีรูป | Images visible |
| **H4** | Empty leads message | Unit ที่ไม่มี leads | "ยังไม่มี Lead" message |
| **H5** | Display leads list | Unit ที่มี leads (เช่น 12/143 ของ Baan Issara) | List of leads |
| **H6** | Lead card shows customer name | H5 done | Customer name visible |
| **H7** | Lead card shows status + source | H5 done | Status badge + source |
| **H8** | Close dialog | Click outside or X | Dialog closes |

#### 🟢 I. Add Lead Modal (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **I1** | Open from "เพิ่ม Lead ใหม่" | Click "..." → "เพิ่ม Lead ใหม่" | AddLeadModal opens |
| **I2** | Pre-filled propertyId/unitId | I1 done | propertyName + unitNumber visible in modal |
| **I3** | Cancel doesn't navigate | Click cancel/X | Modal closes, stays on /properties |
| **I4** | Submit navigates to /leads | Fill form → Save (skip actual creation if it modifies data) | Navigates to /leads |

#### 🖼️ J. Image Upload (10 cases)

##### J.1 Thumbnail (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **J1** | Upload thumbnail preview | F1 → click thumbnail upload → select PNG | Preview + X button + "อัปโหลดสำเร็จ" |
| **J2** | Remove thumbnail | J1 → click X | Preview gone, upload area returns |
| **J3** | Upload then save | J1 → Save unit | thumbnail_url saved (verify via Supabase MCP read) |
| **J4** | File type validation | Upload non-image | Error or rejection |
| **J5** | ObjectURL revoked on remove | J2 done | (verify no memory leak — best effort, check via console.log if needed) |

##### J.2 Gallery (5 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **J6** | Upload single gallery image | F1 → upload 1 gallery | Preview added |
| **J7** | Upload multiple gallery | Upload 3 images at once | All 3 previews |
| **J8** | Remove individual image | J6 done → click X on one | That image removed, others remain |
| **J9** | Save with gallery | J6 → Save | images[] array saved |
| **J10** | Storage path format | After J9 | Path = `{tenant_id}/{project_id}/gallery/...` |

#### 📝 K. Activity Logging (8 cases)

> Verify via Supabase MCP `execute_sql` (read SELECT only) on `activity_log` table

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **K1** | unit_created log entry | After G1 | activity_log has new entry with type='unit_created' |
| **K2** | unit_updated log entry | After G3 | activity_log has 'unit_updated' entry |
| **K3** | unit_deleted log entry | After G7 | activity_log has 'unit_deleted' entry |
| **K4** | property_deleted log entry | After E4 | activity_log has 'property_deleted' entry |
| **K5** | Metadata includes property_id | K1-4 | metadata.property_id present |
| **K6** | Metadata includes project_id (units) | K1-3 | metadata.project_id present |
| **K7** | Description format correct | K1-4 | Description matches format from report |
| **K8** | log_activity error doesn't block save | (Hard to simulate — skip if cant force error) | If can simulate: save still succeeds |

#### 🗂️ L. State Management (6 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **L1** | Filter persists in same view | Filter "คอนโด" → click project → back | Filter still "คอนโด" |
| **L2** | Modal state resets after close | Open Add Unit → fill → close → reopen | Empty form |
| **L3** | Edit state cleared after save | Edit unit → save → check editingUnit | Cleared (next "Add" is fresh) |
| **L4** | selectedProperty persists in View 2 | View 2 → reload page | (Note: state is per session — won't persist after reload, OK) |
| **L5** | Search query preserved | Type "BAAN" → click project → back | Search still "BAAN" |
| **L6** | minPrices loaded after fetchProperties | View 1 | Cards show minPrices (lower than base_price for some) |

#### 🛠️ M. Helper Functions (18 cases)

##### M.1 formatPriceShort (4 cases) — verify via UI

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **M1** | ≥1M → "X.X ล้านบาท" | View card with high price (e.g., 15M) | "15.0 ล้านบาท" |
| **M2** | ≥1K → "X พันบาท" | (Hard to find data) | If exists: "XX พันบาท" |
| **M3** | <1K → "X บาท" | (Hard to find) | If exists: "XX บาท" |
| **M4** | null/0 → "-" | View card with no price | "-" displayed |

##### M.2 formatCurrency (2 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **M5** | Format THB | View "มูลค่ารวม" KPI | "฿XX,XXX,XXX" with commas |
| **M6** | Zero amount | (find unit price=0) | "฿0" |

##### M.3 getPropertyTypeLabel (8 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **M7** | apartment → "อพาร์ตเมนท์" | Type filter dropdown | Label shown |
| **M8** | house → "บ้านเดี่ยว" | Same | "บ้านเดี่ยว" |
| **M9** | single_house → "บ้านเดี่ยว" | Card with single_house | Badge "บ้านเดี่ยว" |
| **M10** | twin_house → "บ้านแฝด" | Type filter | "บ้านแฝด" |
| **M11** | townhome → "ทาวน์โฮม" | Type filter | "ทาวน์โฮม" |
| **M12** | villa → "วิลล่า" | Type filter | "วิลล่า" |
| **M13** | condo → "คอนโด" | Type filter | "คอนโด" |
| **M14** | commercial → "อาคารพาณิชย์" | Type filter | "อาคารพาณิชย์" |

##### M.4 getUnitStatusBadge (4 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **M15** | available → ว่าง (default variant) | Find unit with status='available' | Badge "ว่าง" |
| **M16** | reserved → จอง (secondary) | Find unit reserved | Badge "จอง" |
| **M17** | sold → ขายแล้ว (destructive) | Find unit sold | Badge "ขายแล้ว" red |
| **M18** | unavailable → ไม่ว่าง (outline) | Find unit unavailable | Badge "ไม่ว่าง" |

#### ⚠️ N. Edge Cases (10 cases — matching report Section 14)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **N1** | No currentTenant fallback | Find user with no tenant or simulate | "กรุณาเลือกบริษัทก่อน" |
| **N2** | properties list empty | Fresh tenant or filter to empty | "ไม่พบโครงการ" + icon |
| **N3** | units list empty | Project with 0 units | "ไม่พบยูนิต" |
| **N4** | No thumbnail_url fallback | Project without thumbnail | Building2 icon |
| **N5** | Price = 0 → "-" | (find unit) | "-" displayed |
| **N6** | floor_number = null → "-" | (find unit) | "-" displayed |
| **N7** | area_sqm = null → "-" | (find unit) | "-" displayed |
| **N8** | Image upload error handled | Upload invalid file | Doesn't crash, log error |
| **N9** | log_activity error doesn't block | (simulate via network throttle if possible) | Save still succeeds |
| **N10** | Cross-table dedupe works | Verify properties+projects merge | 33 cards, no duplicates (count via UI) |

#### 🌐 O. Toast Notifications (10 cases)

| ID | Test Case | Steps | Expected |
|----|-----------|-------|----------|
| **O1** | Toast.success on Save Unit | After G1 | Green toast appears |
| **O2** | Toast.error on Save fail | (force error: rapid duplicate insert?) | Red toast |
| **O3** | Toast.success on Delete Unit | After G7 | Green toast |
| **O4** | Toast.success on Delete Project | After E4 | Green toast |
| **O5** | Toast text shows unit_number | O1 done | Text contains the unit number |
| **O6** | Toast text shows project name | O4 done | Text contains project name |
| **O7** | Toast auto-dismisses | Wait 5 seconds | Toast disappears |
| **O8** | Multiple toasts stack | Trigger 2 saves quickly | Toasts stack vertically |
| **O9** | Toast position consistent | Multiple operations | Same position each time |
| **O10** | Click toast dismisses | Click on toast | Disappears immediately |

---

### 🚨 Failure Handling Protocol

ถ้า test FAIL:

1. **บันทึก evidence:** screenshot, console error, expected vs actual
2. **วิเคราะห์ root cause:**
   - Bug ใน source code (`src/`)
   - Data issue ใน DB (บันทึกไว้ — ห้ามแก้)
   - Test environment (dev server, browser)
3. **ถ้าเป็น Bug ใน code:**
   - อ่าน code relevant
   - แก้ขั้นต่ำที่สุด (minimal fix)
   - **ถ้าแก้แล้วเปลี่ยน behavior สำคัญ → ต้องถาม user ก่อน**
   - Re-run test → verify pass
4. **ถ้าเป็น Data:** บันทึก "Known Issues" → skip test
5. **ถ้าเป็น Environment:** restart
6. **Loop:** จนกว่าจะ PASS หรือกำหนด "Acceptable Failure"

#### ขีดจำกัดแก้บั๊ก
- ✅ **อนุญาต:** แก้ code ใน `src/`
- ⚠️ **ขอยืนยันก่อน:** เปลี่ยน DB schema, ลบ functionality, big refactor
- 🔴 **ห้าม:** แก้ DB data, แก้ test ให้ผ่าน (test gaming)

---

### 📊 Output Format

#### 1. Inline Summary (แสดงในการตอบ)

```
| Category | PASS | FAIL | SKIPPED | Total |
|----------|------|------|---------|-------|
| A. Auth & Permissions | XX | X | X | 30 |
| B. View 1 | XX | X | X | 18 |
| ... | ... | ... | ... | ... |
| **TOTAL** | **XXX** | **XX** | **XX** | **205** |

**Bugs Found & Fixed:** N
**Acceptable Failures:** N (with reasons)
```

#### 2. Detailed Report ที่ `docs/PROPERTY_MANAGEMENT_TEST_RESULTS.md`

```markdown
# 🧪 Property Management Test Results

**Date:** YYYY-MM-DD
**Environment:** localhost:5173, branch=001-production-readiness, commit=XXXX
**Total Time:** Xh XXm

## Executive Summary
- Total: 205 cases
- PASS: XX
- FAIL: XX (auto-fixed: XX, deferred: XX)
- SKIPPED: XX (with reasons)

## Coverage by Section
[per-section breakdown]

## Detailed Results
[per-test detail with screenshots, errors, fixes]

## Bugs Found & Fixed
[list of bugs + diff/commit]

## Known Issues / Skipped
[reasons]

## Recommendations
[improvements]
```

---

### 🛡️ Constraints & Guardrails

1. **ห้ามแก้ DB โดยตรง** — ใช้แค่ UI
2. **Test data ทุกตัว prefix** `[TEST]`
3. **Cleanup ทุก [TEST] records** หลังจบ
4. **ห้าม commit/push** ระหว่างทดสอบ
5. **ห้ามรัน destructive scripts**
6. **เก็บ screenshot ทุก critical step**
7. **TodoWrite tool:** ใช้ติดตาม progress (sub-todos per category)
8. **ห้าม skip test เพราะขี้เกียจ** — ถ้า skip ต้องมีเหตุผลชัดเจน

---

### 🚦 Workflow

**Phase 1: Preparation (15 นาที)**
1. อ่าน documents
2. Pre-flight checks
3. สร้าง todo list (15 main + sub-todos)
4. Login ทุก role ที่มี

**Phase 2: Execution (3-4 ชั่วโมง)**
5. Run tests A → O ตามลำดับ
6. Mark each as PASS/FAIL ใน todo
7. Fix-test loop

**Phase 3: Cleanup & Report (30 นาที)**
8. ลบ `[TEST]` data ผ่าน UI
9. เขียนรายงาน
10. แสดง summary

---

### 📝 หมายเหตุสุดท้าย

- Browser ค้าง → `browser_close` + navigate ใหม่
- Dev server crash → restart `npm run dev` background
- Playwright API ไม่พบ → ToolSearch โหลด schema
- ถ้า user มี input ระหว่างกลาง — รับฟังแล้ว resume
- เก็บ TodoWrite list ตั้งแต่เริ่มและ update ทุก phase

**เริ่มได้เมื่อพร้อม — สรุปผลครบทุก case แล้วรอ user ตัดสินใจขั้นต่อไป**

---

## 🤖 PROMPT END

---

## 📊 ตัวชี้วัดความสำเร็จของ Prompt v2

| ตัวชี้วัด | เป้าหมาย | เพิ่มจาก v1 |
|----------|---------|------------|
| Test cases coverage | **205 cases** ครบ 16 sections | +170 |
| Permission scenarios | 3 roles ทุก action | +26 |
| CreateProjectModal fields | ครบ 18+ fields | +25 |
| Helper functions tested via UI | 18 cases | +18 |
| Activity logging verification | 8 cases | +8 |
| State management | 6 cases | +6 |
| Toast scenarios | 10 cases | +9 |
| Edge cases | 10 (ตรงรายงาน) | +6 |
| Pass rate after auto-fix | ≥95% | - |
| DB direct modification | 0 | - |
| Final report file | `docs/PROPERTY_MANAGEMENT_TEST_RESULTS.md` | - |

---

## 🔄 การปรับปรุง Prompt ในอนาคต

หลังใช้ prompt v2 ถ้าพบว่า:
- Test cases ยังขาด → เพิ่มในไฟล์นี้ (อย่าสร้างไฟล์ใหม่)
- Test ทำซ้ำได้ลำบาก → ปรับ Steps
- Failure protocol ไม่ครอบคลุม → เพิ่ม case
- Output format ใช้ไม่สะดวก → ปรับ template

---

## 📚 References

- [PROPERTY_MANAGEMENT_REPORT.md](./PROPERTY_MANAGEMENT_REPORT.md) — รายงานข้อมูลฟีเจอร์ (source of truth)
- [src/pages/PropertyManagement.tsx](../src/pages/PropertyManagement.tsx) — Source code
- [src/components/properties/CreateProjectModal.tsx](../src/components/properties/CreateProjectModal.tsx)
- [src/components/auth/PermissionGuard.tsx](../src/components/auth/PermissionGuard.tsx)
- [scripts/list-admins.cjs](../scripts/list-admins.cjs) — ดู admin users
- [scripts/reset-admin-password.cjs](../scripts/reset-admin-password.cjs) — รีเซ็ตรหัส (ใช้ login เท่านั้น)

---

*Prompt v2 สร้างขึ้นโดย Claude Code (Opus 4.7) เมื่อ 2026-04-27*
*v1 มี 35 cases (~19% coverage) → v2 มี 205 cases (~100% coverage)*
