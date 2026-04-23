#!/usr/bin/env node

// สคริปต์สำหรับสร้างฐานข้อมูลแบบง่าย
// รันด้วย: node setup-database.js

const fs = require('fs');
const path = require('path');

console.log('🎯 CHATEAU Platform - Database Setup Guide');
console.log('=' .repeat(50));

console.log('\n📋 Steps to Setup Database:');

console.log('\n1. เข้า Supabase Dashboard:');
console.log('   https://supabase.com/dashboard');

console.log('\n2. เลือกโปรเจค: CHATEAU Platform');

console.log('\n3. ไป SQL Editor และรันคำสั่งนี้:');
console.log('-'.repeat(30));

const sqlCommands = `
-- Create invoices table for Auto Billing
CREATE TABLE IF NOT EXISTS invoices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_number text NOT NULL UNIQUE,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    status text NOT NULL DEFAULT 'pending',
    subscription_plan text NOT NULL DEFAULT 'starter',
    due_date timestamptz NOT NULL,
    paid_at timestamptz,
    description text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    invoice_id uuid REFERENCES invoices(id) ON DELETE CASCADE,
    invoice_number text,
    amount decimal(10,2) NOT NULL DEFAULT 0,
    currency text NOT NULL DEFAULT 'THB',
    payment_method text NOT NULL DEFAULT 'bank_transfer',
    payment_status text NOT NULL DEFAULT 'pending',
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Owners can manage all invoices" ON invoices
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );

CREATE POLICY "Owners can manage all payments" ON payments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles p
            WHERE p.user_id = auth.uid()
            AND p.role = 'owner'
        )
    );
`;

console.log(sqlCommands);

console.log('-'.repeat(30));
console.log('\n4. หลังรันเสร็จให้:');
console.log('   ✅ รีเฟรชหน้าเว็บ');
console.log('   ✅ ลองกด Auto Billing อีกครั้ง');
console.log('   ✅ ตรวจสอบ Console หาข้อผิดพลาด');

console.log('\n🎯 Migration Files Overview:');
console.log('   📁 Total Files: 85+ migrations');
console.log('   🔧 Core: 4 files (initial schema, roles, RLS, auth)');
console.log('   💰 Billing: 3 files (invoices, payments, plans)');
console.log('   👥 Users: 15+ files (auth, invites, management)');
console.log('   🏢 Features: 60+ files (campaigns, leads, properties)');

console.log('\n❗ Important Notes:');
console.log('   - เนื่องจากมี migrations มากมาย การรันทีเดียวทั้งหมดอาจมีปัญหา');
console.log('   - แนะนำให้รันเฉพาะส่วนที่จำเป็นก่อน (invoices & payments)');
console.log('   - หากต้องการครบถ้วนให้ติดต่อ Admin สำหรับ bulk migration');

console.log('\n🔗 Useful Links:');
console.log('   Supabase Dashboard: https://supabase.com/dashboard');
console.log('   Project URL: https://pqnjvcbmnatrtvpqnrdx.supabase.co');

console.log('\n' + '='.repeat(50));
console.log('🚀 Ready to setup your database!');