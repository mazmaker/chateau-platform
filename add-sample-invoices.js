// สคริปต์สร้างข้อมูลตัวอย่างใบแจ้งหนี้สำหรับทดสอบปฏิทิน
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2OTgwNDMsImV4cCI6MjA0ODI3NDA0M30.LO8CRf2YN_5I2E0kE1cYPKJjLBl9OQJPjKqo4Vz7S88'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function addSampleInvoices() {
  console.log('🚀 เริ่มเพิ่มข้อมูลตัวอย่างใบแจ้งหนี้...');

  try {
    // ดึงข้อมูล tenants ที่มีอยู่
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(5);

    if (tenantsError) {
      console.error('❌ Error fetching tenants:', tenantsError);
      return;
    }

    if (!tenants || tenants.length === 0) {
      console.log('⚠️ ไม่มีข้อมูล tenants ในระบบ');
      return;
    }

    console.log(`📋 พบ ${tenants.length} บริษัท:`, tenants.map(t => t.name));

    // สร้างข้อมูลตัวอย่าง
    const sampleInvoices = [];
    const today = new Date();

    // 1. ใบแจ้งหนี้เกินกำหนด (2-3 ใบ)
    for (let i = 0; i < Math.min(2, tenants.length); i++) {
      const tenant = tenants[i];
      const overdueDate = new Date(today);
      overdueDate.setDate(today.getDate() - (5 + i * 3)); // เกินกำหนด 5, 8 วัน

      sampleInvoices.push({
        tenant_id: tenant.id,
        invoice_number: `INV-2024-${String(125 + i).padStart(4, '0')}`,
        amount: i === 0 ? 1990.00 : 4990.00,
        currency: 'THB',
        status: 'overdue',
        subscription_plan: i === 0 ? 'starter' : 'enterprise',
        due_date: overdueDate.toISOString(),
        description: `Monthly subscription - ${i === 0 ? 'Starter' : 'Enterprise'} Plan`,
        created_at: new Date(today.getTime() - (10 + i) * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // 2. ใบแจ้งหนี้ครบกำหนดวันนี้ (1-2 ใบ)
    if (tenants.length >= 3) {
      const dueTodayTenant = tenants[2];
      sampleInvoices.push({
        tenant_id: dueTodayTenant.id,
        invoice_number: `INV-2024-0156`,
        amount: 1990.00,
        currency: 'THB',
        status: 'pending',
        subscription_plan: 'starter',
        due_date: today.toISOString(),
        description: 'Monthly subscription - Starter Plan',
        created_at: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    // 3. ใบแจ้งหนี้ครบกำหนดใน 7 วันข้างหน้า (2-3 ใบ)
    for (let i = 0; i < Math.min(2, tenants.length); i++) {
      const tenant = tenants[Math.min(i + 3, tenants.length - 1)];
      const futureDate = new Date(today);
      futureDate.setDate(today.getDate() + (7 + i * 8)); // ครบกำหนดใน 7, 15 วัน

      sampleInvoices.push({
        tenant_id: tenant.id,
        invoice_number: `INV-2024-${String(167 + i).padStart(4, '0')}`,
        amount: i === 0 ? 1990.00 : 4990.00,
        currency: 'THB',
        status: 'pending',
        subscription_plan: i === 0 ? 'starter' : 'enterprise',
        due_date: futureDate.toISOString(),
        description: `Monthly subscription - ${i === 0 ? 'Starter' : 'Enterprise'} Plan`,
        created_at: new Date(today.getTime() - (5 + i) * 24 * 60 * 60 * 1000).toISOString()
      });
    }

    console.log(`📄 เตรียมเพิ่ม ${sampleInvoices.length} ใบแจ้งหนี้:`);
    sampleInvoices.forEach(invoice => {
      console.log(`   • ${invoice.invoice_number} - ${invoice.status} - Due: ${new Date(invoice.due_date).toLocaleDateString('th-TH')}`);
    });

    // เพิ่มข้อมูลลง database
    const { data, error } = await supabase
      .from('invoices')
      .insert(sampleInvoices)
      .select();

    if (error) {
      console.error('❌ Error inserting invoices:', error);
      return;
    }

    console.log(`✅ เพิ่มข้อมูลเสร็จแล้ว! จำนวน ${data.length} ใบแจ้งหนี้`);
    console.log('🎯 ตอนนี้สามารถไปดูปฏิทินแจ้งเตือนได้ที่: http://localhost:5175/payments');
    console.log('📅 กดที่แท็บ "ปฎิทินแจ้งเตือน" เพื่อดูผลลัพธ์');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// เรียกใช้ function
addSampleInvoices();