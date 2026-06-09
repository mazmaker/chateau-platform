# 📧 Email Service Configuration Guide

## ขั้นตอนการตั้งค่าอีเมลจริง (Resend.com) - ง่ายมาก!

### 1. สร้าง Resend Account (ไม่ต้องมีโดเมน!)
1. ไปที่ [Resend.com](https://resend.com)
2. สร้างบัญชีฟรี (3,000 emails/month)
3. ยืนยันอีเมล - **เสร็จ!** ไม่ต้องตั้งค่าอะไรเพิ่ม

### 2. สร้าง API Key (ง่ายสุดๆ)
1. เข้า Resend Dashboard
2. ไปที่ "API Keys" 
3. กด "Create API Key"
4. ตั้งชื่อ เช่น "CHATEAU Platform"
5. กด "Add" - ได้ API Key เลย!

### 3. ตั้งค่า Environment Variables
สร้างไฟล์ `.env` จากไฟล์ `.env.example`:

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env` ใส่ค่าจริง:
```bash
# Resend Configuration (ง่ายมาก!)
# สำหรับ Development (Vite)
VITE_RESEND_API_KEY=re_your_actual_api_key_here
# สำหรับ Production Server
RESEND_API_KEY=re_your_actual_api_key_here

# Email Settings
VITE_FROM_EMAIL=onboarding@resend.dev  # ใช้ได้เลยไม่ต้องมีโดเมน!
VITE_FROM_NAME=CHATEAU Platform
VITE_BILLING_EMAIL=billing@chateau-platform.com
VITE_SUPPORT_PHONE=02-123-4567

# Environment
NODE_ENV=production
```

### 4. ทดสอบการส่งเมล (ใช้งานได้ทันที!)
```typescript
import { emailService } from '@/lib/email-service';

// ทดสอบส่งอีเมลจริง
const testData = {
  tenant_name: "Test Tenant",
  invoice_number: "INV-2026-001",
  amount: 1500,
  due_date: "2026-04-30",
  tenant_email: "test@example.com"
};

await emailService.queueEmail('invoice_created', testData);
```

## ทำไม Resend ดีกว่า SendGrid?

### ✅ Resend.com
- 🚀 ไม่ต้องมีโดเมน - ใช้ได้เลย!
- 📧 3,000 emails/month ฟรี
- 🎯 Setup ง่าย 5 นาที
- 💻 API สะอาด TypeScript support
- 📊 Dashboard ใช้งานง่าย

### ❌ SendGrid
- 🌐 ต้องมีโดเมนเพื่อ verify
- 📧 100 emails/day ฟรี
- 😵 Setup ซับซ้อน DNS records
- 🔧 API ใช้ยาก
- 📈 Dashboard ซับซ้อน

## สลับโมด Mock/Production

### ⚠️ สำคัญ: Environment Variables ใน Vite
- **VITE_*** ตัวแปรที่ขึ้นต้น VITE_ = ใช้ในเบราว์เซอร์ได้
- **ตัวแปรปกติ** = ใช้ในเซิร์ฟเวอร์เท่านั้น

**สำหรับพัฒนา:** ใช้ VITE_RESEND_API_KEY  
**สำหรับ Production:** ใช้ RESEND_API_KEY

### Mock Mode (พัฒนา)
```bash
NODE_ENV=development
```
- แสดงเฉพาะใน Console
- ไม่ส่งเมลจริง
- ใช้สำหรับทดสอบ

### Production Mode (จริง)
```bash
NODE_ENV=production
RESEND_API_KEY=re_your_key_here
```
- ส่งเมลผ่าน Resend
- ใช้ในระบบจริง

## การตรวจสอบสถานะ

### 1. ตรวจสอบ Queue
```typescript
const status = emailService.getQueueStatus();
console.log('Email Queue:', status);
```

### 2. ดู Resend Dashboard
- เข้า Resend Dashboard > Emails
- ดูสถานะการส่ง: Sent, Delivered, Bounced
- Real-time tracking

### 3. ตรวจสอบ Logs
```bash
# ใน Console จะแสดง
✅ Resend initialized for production
📧 Queued email: [subject] to [email]
✅ Email sent successfully to [email]
```

## เทมเพลตอีเมลที่มี

1. **invoice_created** - ใบแจ้งหนี้ใหม่
2. **reminder_3_days** - เตือนเหลือ 3 วัน
3. **reminder_1_day** - เตือนเหลือ 1 วัน  
4. **overdue_notice** - เกินกำหนด
5. **final_warning** - เตือนสุดท้าย
6. **service_suspended** - ระงับบริการ
7. **payment_received** - ยืนยันการชำระ

## เพิ่ม Custom Domain (ทีหลังเมื่อมีโดเมน)

### ขั้นตอน:
1. ไปที่ Resend Dashboard > Domains
2. กด "Add Domain"
3. ใส่โดเมนของคุณ
4. เพิ่ม DNS Records (ง่ายกว่า SendGrid!)
5. Verify - เสร็จ!

### ประโยชน์:
- อีเมลจาก your@domain.com
- เพิ่ม credibility
- ลด spam rate

## การแก้ไขปัญหา

### Error: Unauthorized
- ตรวจสอบ API Key ถูกต้อง
- ตรวจสอบใน Resend Dashboard

### Email ไปใน Spam (หายาก)
- Content ไม่มีคำต้องสงสัย
- Resend มี reputation ดี

### Rate Limiting
- Resend Free: 3,000 emails/month
- Paid plan: ไม่จำกัด

## Quick Start สำหรับคนรีบ

```bash
# 1. ไปสร้างบัญชี resend.com
# 2. ได้ API Key
# 3. สร้าง .env (สำคัญ: ใช้ VITE_ prefix)
echo "VITE_RESEND_API_KEY=re_your_key_here" > .env
echo "NODE_ENV=production" >> .env

# 4. รัน - ใช้งานได้เลย!
npm run dev
```

---

✅ **ใช้งานได้ใน 5 นาที!** ไม่ต้องมีโดเมนก็ส่งเมลได้