# 📋 Product Requirements Document (PRD)
**Project Name:** Chateau - Prop Tech Intelligence (SaaS Platform)
**Version:** 8.0 (Final Master Complete)
**Date:** 17 December 2025
**Status:** Approved for Development

## 1. Executive Summary (บทสรุปผู้บริหาร)
**Chateau** คือแพลตฟอร์มบริหารจัดการอสังหาริมทรัพย์อัจฉริยะ (Real Martech Intelligence) ในรูปแบบ SaaS ที่เปลี่ยนกระบวนการขายสู่ระบบดิจิทัลโดยสมบูรณ์ จุดเด่นสำคัญคือการ **รวมศูนย์ข้อมูล (Centralized Data) จากทั้งช่องทางออฟไลน์ (Walk-in) และออนไลน์ (Web/Social) ให้เชื่อมโยงกันเป็นหนึ่งเดียว** ผ่านการเชื่อมต่อ **LINE OA (LIFF)** พร้อมขับเคลื่อนด้วย **AI Scoring** ที่ช่วยวิเคราะห์ความสนใจและกำลังซื้อของลูกค้า ทำให้ทีมขายสามารถคัดกรองกลุ่มเป้าหมายได้แม่นยำ ปิดการขายได้รวดเร็ว และบริหารจัดการยูนิตโครงการได้แบบ Real-time

## 2. Target Users (กลุ่มผู้ใช้งาน)
1.  **System Admin:** ผู้ดูแลระบบ Chateau (เจ้าของ Platform / Super Admin)
2.  **Company Admin:** เจ้าของโครงการ/ผู้เช่าใช้ระบบ (ลูกค้า SaaS)
3.  **Sales:** พนักงานขายหน้างาน
4.  **User:** ลูกค้าโครงการ (End-user ใช้งานผ่าน LINE)

---

## 3. Functional Requirements (รายละเอียดฟังก์ชัน)

### 💎 Epic 0: SaaS Foundation & Authentication (ระบบพื้นฐาน SaaS)
*   **FR0.1 Multi-Tenant Architecture:** ระบบแยกข้อมูลแต่ละบริษัท (Data Isolation) ผ่าน `tenant_id` อย่างเคร่งครัด
*   **FR0.2 Authentication:** Login (Email/Pass), Forgot Password, Force Logout (เตะออกจากระบบเมื่อ Login ซ้อน)
*   **FR0.3 Company Settings (White-label):** [Admin] อัปโหลด Logo, ตั้งค่าสีธีมบริษัท, ข้อมูลบริษัทสำหรับหัวบิล
*   **FR0.4 Subscription:** จัดการสถานะแพ็กเกจ (Standard/Premium) และวันหมดอายุ
*   **FR0.5 User Profile:** แก้ไขข้อมูลส่วนตัว, เปลี่ยนรหัสผ่าน, ตั้งค่าการแจ้งเตือน

### 🔹 Epic 1: Dashboard Overview (ภาพรวมการบริหารงาน)
*   **FR1.1 Global Filters:** ตัวกรองข้อมูลหลัก (ช่วงเวลา, โครงการ, ประเภท) ส่งผลต่อทุกกราฟ
*   **FR1.2 Sales Overview:** แสดงยอดขายรวม, จำนวนยูนิต (จอง/ขาย/ยกเลิก) แบบ Real-time
*   **FR1.3 Project Performance:** แสดงยอดขายและมูลค่า แยกตามรายโครงการ
*   **FR1.4 Customer Stats:**
    *   Funnel: Leads -> Conversions -> Customers -> Rate (%)
    *   Graph: เปรียบเทียบสถานะลูกค้า (New/Booking/Transfer)
    *   Graph: Trend รายเดือน (New vs Customer, Booking vs Cancel)

### 🔹 Epic 2: Real Estate Data Management (จัดการอสังหาฯ)
*   **FR2.1 Master Data:** [Admin] จัดการ หมวดหมู่ และ โครงการ (เพิ่ม/ลบ/แก้ไข)
*   **FR2.2 Inventory Mgmt:** [Admin]
    *   จัดการข้อมูลยูนิต (ราคา, พื้นที่, รูปภาพ, ทิศ)
    *   **Bulk Operations:** แก้ไขข้อมูลทีละหลายรายการ (Batch Edit)
    *   **Price History Log:** ดูประวัติการปรับราคาย้อนหลัง
*   **FR2.3 Search & View:** [Sales] ค้นหายูนิต (ราคา/ขนาด) และดูรายละเอียด
*   **FR2.4 Unit Locking (Concurrency Control):**
    *   ระบบ **ล็อคห้องชั่วคราว (15 นาที)** เมื่อ Sales กดจอง ป้องกันการขายซ้ำ (Double Booking)
    *   แสดงสถานะ Real-time: 🟢ว่าง, 🟡กำลังทำรายการ, 🟠จอง, 🔴ขายแล้ว

### 🔹 Epic 3: Customer Data Management (จัดการลูกค้า)
*   **FR3.1 Centralized Input & Notification:**
    *   รับข้อมูลจาก Web Form และ **LINE LIFF** (Auto-fill Profile)
    *   ระบบแจ้งเตือน Admin ทันทีที่มี Lead ใหม่
*   **FR3.2 Assignment:** Admin กด **Assign** จ่ายงานให้ Sales -> แจ้งเตือน Sales
*   **FR3.3 Operations:** [Sales] เพิ่มลูกค้า Walk-in, แก้ไขข้อมูล, **Co-Buyer** (เพิ่มผู้กู้ร่วม), **Attach File** (แนบเอกสาร)
*   **FR3.4 Customer Insights:** แสดง **Potential Score**, **Financial Score**, CDP, Timeline การติดตาม
*   **FR3.5 Data Import:** [Admin] นำเข้าข้อมูลลูกค้าเก่าจาก Excel/CSV

### 🔹 Epic 4: Sales Data Management (จัดการพนักงานขาย)
*   **FR4.1 Staff Mgmt:** [Admin] สร้างบัญชี, กำหนดสิทธิ์, ระงับบัญชี (Suspend)
*   **FR4.2 Staff Directory:** แสดงรายชื่อพนักงานทั้งหมด
*   **FR4.3 Lead Re-Assignment:** [Admin] โอนย้ายลูกค้าจาก Sales A ไป Sales B
*   **FR4.4 Sales Workspace:** [Sales]
    *   **My Customers:** ดูรายการลูกค้าของตนเอง
    *   **My Stats:** ดูสถิติยอดขายและผลงานตนเองเทียบเป้าหมาย (Target Tracking)
*   **FR4.5 Audit Log:** [Admin] ดูบันทึกการใช้งานระบบย้อนหลัง (ใครทำอะไร เมื่อไหร่)

### 🔹 Epic 5: AI Automation (ระบบอัตโนมัติ)
*   **FR5.1 AI Segmentation:** จัดกลุ่มลูกค้าอัตโนมัติจาก Score/พฤติกรรม
*   **FR5.2 Automation Overview:** Dashboard แสดงจำนวนลูกค้า/แคมเปญ/Segment, Conversion Rate
*   **FR5.3 Campaign Mgmt:** [Admin] สร้าง/แก้ไข/ลบ แคมเปญ (LINE/SMS), กำหนดเวลาส่ง
*   **FR5.4 Performance:** รายงานผลลัพธ์แคมเปญ (Sent, Read, Clicked)

### 🔹 Epic 6: Data Visualization (วิเคราะห์เชิงลึก)
*   **FR6.1 Sales Deep Dive:** กราฟสัดส่วนสถานะ, เปรียบเทียบ Lead/Booking
*   **FR6.2 Staff Performance:** ตารางเปรียบเทียบผลงานพนักงานขายทุกคน
*   **FR6.3 Source Analysis:** กราฟวิเคราะห์แหล่งที่มา (Online/Offline) พร้อม Conversion Rate
*   **FR6.4 Purpose Analysis:** กราฟวิเคราะห์วัตถุประสงค์การซื้อ (อยู่เอง/เก็งกำไร)

---

## 4. Permission Matrix (ตารางสรุปสิทธิ์การใช้งาน)

| กลุ่มฟังก์ชัน (Feature Group) | 👑 Admin (ผู้บริหาร/ผู้ดูแล) | 👤 Sales (พนักงานขาย) |
| :--- | :--- | :--- |
| **0. ตั้งค่าระบบ (System)** | ตั้งค่าบริษัท / โลโก้ / ดู Audit Log | แก้ไขข้อมูลส่วนตัว / เปลี่ยนรหัสผ่าน |
| **1. แดชบอร์ด (Dashboard)** | **เห็นภาพรวมทั้งบริษัท** (ทุกโครงการ/ทุกคน) <br>+ กด Export รายงานได้ | **เห็นเฉพาะ Dashboard ส่วนตัว** <br>(ยอดขายและลูกค้าของตนเองเท่านั้น) |
| **2. อสังหาฯ (Real Estate)** | **จัดการข้อมูลได้ทุกอย่าง** <br>(เพิ่ม/ลบ/แก้ไขราคา/แก้ไขกลุ่ม/ดู Log) | **ดูและจองเท่านั้น** <br>(ค้นหา/ดูสถานะ/กดจอง Lock Unit) |
| **3. ลูกค้า (Customer)** | **เห็นลูกค้าทุกคน** <br>+ จ่ายงาน (Assign) + นำเข้าข้อมูล (Import) | **เห็นเฉพาะลูกค้าตนเอง** <br>+ เพิ่มลูกค้า Walk-in + แนบไฟล์/ผู้กู้ร่วม |
| **4. ทีมขาย (Sales Team)** | **จัดการบัญชีลูกน้อง** <br>(สร้าง/ระงับ/โอนย้ายงาน) | **ดูสถิติตนเอง** <br>(Conversion Rate / Target) |
| **5. AI & การตลาด** | **จัดการแคมเปญ** <br>(สร้าง/ส่ง/ดูผลลัพธ์) / ดู Segment | **ไม่มีสิทธิ์เข้าถึง** <br>(ป้องกันการส่งข้อความรบกวนลูกค้า) |
| **6. วิเคราะห์เชิงลึก** | **ดูวิเคราะห์ได้ทุกมิติ** <br>(แหล่งที่มา/วัตถุประสงค์/เปรียบเทียบ) | **ไม่มีสิทธิ์เข้าถึง** |

---

## 5. Non-Functional Requirements (NFR) - Enterprise Grade

### 🛡️ 5.1 Security & Compliance (ความปลอดภัย)
*   **NFR1.1 Data Encryption:** เข้ารหัสข้อมูล Sensitive (AES-256) และการส่งข้อมูล (TLS 1.3)
*   **NFR1.2 PDPA Compliance:** มีระบบ Data Retention และ Consent Log
*   **NFR1.3 Rate Limiting:** ป้องกัน Spam จากหน้าเว็บ/LIFF
*   **NFR1.4 2FA/MFA:** รองรับ OTP สำหรับ Admin Login (Optional)
*   **NFR1.5 Session Mgmt:** Auto-logout เมื่อไม่ใช้งาน (30 นาที)
*   **NFR1.6 OWASP:** ป้องกัน SQL Injection, XSS และทดสอบ RLS Policy เสมอ

### ⚡ 5.2 Performance & Scalability (ประสิทธิภาพ)
*   **NFR2.1 Real-time:** อัปเดตสถานะห้องถึงผู้ใช้ทุกคนภายใน < 500ms
*   **NFR2.2 Page Load:** Dashboard โหลดเสร็จภายใน 1.5 วินาที
*   **NFR2.3 Background Jobs:** ใช้ Asynchronous Queue สำหรับงานหนัก (Import, Broadcast, AI Calc)
*   **NFR2.4 Connection Pooling:** ใช้ **Supavisor** รองรับ Concurrent User จำนวนมาก
*   **NFR2.5 Caching:** ใช้ **Redis** Cache สำหรับ Dashboard และ **CDN** สำหรับรูปภาพ

### 🔧 5.3 Reliability & Integrity (ความเสถียร)
*   **NFR3.1 Tenant Isolation:** รับประกันข้อมูลข้ามบริษัทไม่รั่วไหล 100% (Strict RLS)
*   **NFR3.2 Transactional Integrity:** การจองต้องใช้ DB Transaction (ACID)
*   **NFR3.3 Availability:** SLA 99.9% พร้อมระบบ Automated Backup

---

## 6. Technical Specifications (ข้อกำหนดเทคนิค)

*   **Architecture:** **SaaS Multi-Tenancy** (Shared Database, Isolated Schemas via RLS)
*   **Frontend:** React.js / Vue.js + Tailwind CSS
*   **Backend:** Node.js (NestJS) / Python (FastAPI)
*   **Database:** **Supabase** (PostgreSQL + Auth + Realtime + Storage)
*   **Integrations:**
    *   **LINE Messaging API** (Push/Multicast)
    *   **LINE LIFF SDK** (Lead Form)
    *   **SMS Gateway** (OTP/Alert)

---
