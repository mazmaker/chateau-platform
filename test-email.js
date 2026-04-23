// Quick email test for CHATEAU Platform
// วิธีใช้: node test-email.js

import { emailService } from './src/lib/email-service.ts';

async function testEmail() {
  console.log('🧪 ทดสอบส่งอีเมล...');

  const testData = {
    tenant_name: "ทดสอบ Tenant",
    invoice_number: "INV-2026-TEST",
    amount: 1500,
    due_date: "2026-04-30",
    tenant_email: "test@example.com"
  };

  try {
    // ทดสอบ invoice created email
    const result = await emailService.queueEmail('invoice_created', testData);

    if (result) {
      console.log('✅ ส่งเมลสำเร็จ!');
      console.log('📊 Queue Status:', emailService.getQueueStatus());
    } else {
      console.log('❌ ส่งเมลไม่สำเร็จ');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// รันทดสอบ
testEmail();