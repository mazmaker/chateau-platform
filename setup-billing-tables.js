// สคริปต์สร้างตารางสำหรับระบบ Billing
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://pqnjvcbmnatrtvpqnrdx.supabase.co'
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzI2OTgwNDMsImV4cCI6MjA0ODI3NDA0M30.LO8CRf2YN_5I2E0kE1cYPKJjLBl9OQJPjKqo4Vz7S88'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createBillingTables() {
  console.log('🚀 สร้างตารางระบบ Billing...');

  try {
    // ตรวจสอบตาราง tenants ก่อน
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(1);

    if (tenantError) {
      console.error('❌ ไม่สามารถเข้าถึงตาราง tenants:', tenantError);
      return;
    }

    console.log('✅ เชื่อมต่อ Supabase สำเร็จ');

    // เนื่องจากเราไม่สามารถสร้างตารางผ่าน client ได้โดยตรง
    // ให้ใช้ mock data แทน
    console.log('📝 ใช้ mock data สำหรับการพัฒนา...');

    // สร้างข้อมูลตัวอย่างสำหรับ Payment Dashboard
    const mockInvoices = [
      {
        id: 'inv_001',
        tenant_id: tenants[0]?.id || 'tenant_001',
        invoice_number: 'INV-2024-0001',
        amount: 1990.00,
        currency: 'THB',
        status: 'pending',
        subscription_plan: 'starter',
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Monthly subscription - Starter Plan',
        created_at: new Date().toISOString()
      },
      {
        id: 'inv_002',
        tenant_id: tenants[0]?.id || 'tenant_002',
        invoice_number: 'INV-2024-0002',
        amount: 4990.00,
        currency: 'THB',
        status: 'overdue',
        subscription_plan: 'enterprise',
        due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Monthly subscription - Enterprise Plan',
        created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    const mockPayments = [
      {
        id: 'pay_001',
        tenant_id: tenants[0]?.id || 'tenant_001',
        invoice_id: 'inv_001',
        amount: 1990.00,
        currency: 'THB',
        payment_method: 'bank_transfer',
        payment_date: new Date().toISOString(),
        status: 'completed',
        notes: 'Payment received via bank transfer'
      }
    ];

    // เก็บข้อมูลไว้ใน localStorage สำหรับการพัฒนา
    localStorage.setItem('mockInvoices', JSON.stringify(mockInvoices));
    localStorage.setItem('mockPayments', JSON.stringify(mockPayments));

    console.log('✅ สร้าง mock data สำเร็จ!');
    console.log('📊 ข้อมูลได้ถูกเก็บใน localStorage');
    console.log('🎯 ตอนนี้ Payment Dashboard จะใช้ mock data');

  } catch (error) {
    console.error('💥 Error:', error);
  }
}

// เรียกใช้ function
createBillingTables();