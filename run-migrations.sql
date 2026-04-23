-- Run All Migrations Script
-- Purpose: Execute all necessary migrations to set up the invoice status logging system
-- Instructions: Copy and paste each section into Supabase SQL Editor one by one

-- ====================================================================
-- SECTION 1: CREATE INVOICE STATUS LOGS TABLE
-- ====================================================================
-- Copy this section and run in Supabase SQL Editor first

-- Migration: Create invoice_status_logs table
-- Created: 2026-04-22
-- Purpose: Track all invoice status changes with full audit trail

-- 1. Create invoice_status_logs table
CREATE TABLE IF NOT EXISTS invoice_status_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    tenant_id uuid NOT NULL REFERENCES tenants(id),

    -- Status information
    old_status varchar(20) NOT NULL,
    new_status varchar(20) NOT NULL,

    -- Change details
    changed_by varchar(100) NOT NULL, -- 'SYSTEM', 'USER', email, user_id
    change_type varchar(30) NOT NULL DEFAULT 'manual', -- 'manual', 'auto_overdue', 'payment', 'system'
    reason text,
    notes text,

    -- Additional metadata
    payment_info jsonb, -- Store payment details when status changes to paid
    metadata jsonb DEFAULT '{}', -- Store additional information (browser, IP, etc.)

    -- Timestamps
    created_at timestamp with time zone DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_old_status CHECK (
        old_status IN ('pending', 'paid', 'overdue', 'cancelled', '')
    ),
    CONSTRAINT valid_new_status CHECK (
        new_status IN ('pending', 'paid', 'overdue', 'cancelled')
    ),
    CONSTRAINT valid_change_type CHECK (
        change_type IN ('manual', 'auto_overdue', 'auto_trigger', 'payment', 'system')
    )
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_invoice_id ON invoice_status_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_tenant_id ON invoice_status_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_created_at ON invoice_status_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_change_type ON invoice_status_logs(change_type);
CREATE INDEX IF NOT EXISTS idx_invoice_status_logs_changed_by ON invoice_status_logs(changed_by);

-- 3. Enable Row Level Security
ALTER TABLE invoice_status_logs ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policies
-- Policy for SELECT: Users can view logs for their tenant invoices
CREATE POLICY "Users can view logs for their tenant invoices" ON invoice_status_logs
FOR SELECT USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- Policy for INSERT: Users can insert logs for their tenant invoices
CREATE POLICY "Users can insert logs for their tenant invoices" ON invoice_status_logs
FOR INSERT WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE user_id = auth.uid()
    )
);

-- Policy for system operations
CREATE POLICY "System can insert logs" ON invoice_status_logs
FOR INSERT WITH CHECK (
    changed_by IN ('SYSTEM', 'TRIGGER', 'AUTO_OVERDUE')
);

-- ====================================================================
-- SECTION 2: ADD MISSING COLUMNS (Run after Section 1 completes)
-- ====================================================================

-- Add missing columns to tenants table (if not exists)
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS suspended_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS email varchar(255),
ADD COLUMN IF NOT EXISTS billing_email varchar(255);

-- Add missing columns to invoices table (if not exists)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES tenants(id),
ADD COLUMN IF NOT EXISTS invoice_number varchar(50),
ADD COLUMN IF NOT EXISTS currency varchar(3) DEFAULT 'THB',
ADD COLUMN IF NOT EXISTS subscription_plan varchar(50),
ADD COLUMN IF NOT EXISTS due_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS paid_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS description text;

-- Create company_settings table if not exists
CREATE TABLE IF NOT EXISTS company_settings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name varchar(255),
    billing_automation jsonb DEFAULT '{}',
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW(),

    CONSTRAINT unique_tenant_settings UNIQUE(tenant_id)
);

-- Add billing_settings to profiles if not exists
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS billing_settings jsonb DEFAULT '{}';

-- ====================================================================
-- SECTION 3: CREATE AUTO-TRIGGER (Run after Section 2 completes)
-- ====================================================================

-- Create function to automatically log invoice status changes
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO invoice_status_logs (
            invoice_id,
            tenant_id,
            old_status,
            new_status,
            changed_by,
            change_type,
            reason,
            notes,
            metadata,
            created_at
        ) VALUES (
            NEW.id,
            NEW.tenant_id,
            COALESCE(OLD.status, ''),
            NEW.status,
            'TRIGGER',
            'auto_trigger',
            'Automatic log from database trigger',
            CASE
                WHEN OLD.status IS NULL THEN 'Invoice created'
                ELSE 'Status changed from ' || OLD.status || ' to ' || NEW.status
            END,
            jsonb_build_object(
                'trigger_time', NOW(),
                'old_updated_at', OLD.updated_at,
                'new_updated_at', NEW.updated_at
            ),
            NOW()
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on invoices table
DROP TRIGGER IF EXISTS trigger_log_invoice_status_change ON invoices;
CREATE TRIGGER trigger_log_invoice_status_change
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- ====================================================================
-- VERIFICATION QUERIES
-- ====================================================================
-- Run these to verify everything is working

-- Check if tables exist
SELECT
    table_name,
    CASE WHEN table_name IN (
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
    ) THEN '✅ EXISTS' ELSE '❌ MISSING' END as status
FROM (VALUES
    ('invoice_status_logs'),
    ('company_settings'),
    ('tenants'),
    ('invoices'),
    ('profiles')
) AS t(table_name);

-- Check if columns exist
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
    AND table_name = 'invoice_status_logs'
ORDER BY ordinal_position;

-- Check RLS policies
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'invoice_status_logs'
ORDER BY policyname;

-- Check if trigger exists
SELECT
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trigger_log_invoice_status_change';

-- ====================================================================
-- SUCCESS MESSAGE
-- ====================================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 ===== MIGRATION COMPLETE =====';
    RAISE NOTICE '✅ invoice_status_logs table created';
    RAISE NOTICE '✅ RLS policies applied';
    RAISE NOTICE '✅ Auto-logging trigger installed';
    RAISE NOTICE '✅ Missing columns added';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Next Steps:';
    RAISE NOTICE '1. Test the Status Log Modal in the UI';
    RAISE NOTICE '2. Try changing invoice status manually';
    RAISE NOTICE '3. Run auto overdue detection';
    RAISE NOTICE '4. Check logs with: SELECT * FROM invoice_status_logs ORDER BY created_at DESC;';
    RAISE NOTICE '================================';
END $$;