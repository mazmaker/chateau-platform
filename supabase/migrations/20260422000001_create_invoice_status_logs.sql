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

-- Policy for system operations (allow system to insert without user context)
CREATE POLICY "System can insert logs" ON invoice_status_logs
FOR INSERT WITH CHECK (
    changed_by IN ('SYSTEM', 'TRIGGER', 'AUTO_OVERDUE')
);

-- 5. Create function to automatically log invoice status changes
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

-- 6. Create trigger on invoices table
DROP TRIGGER IF EXISTS trigger_log_invoice_status_change ON invoices;
CREATE TRIGGER trigger_log_invoice_status_change
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_status_change();

-- 7. Add helpful comments
COMMENT ON TABLE invoice_status_logs IS 'Audit trail for all invoice status changes';
COMMENT ON COLUMN invoice_status_logs.invoice_id IS 'Reference to the invoice that changed';
COMMENT ON COLUMN invoice_status_logs.tenant_id IS 'Tenant ID for multi-tenant security';
COMMENT ON COLUMN invoice_status_logs.old_status IS 'Previous status (empty string for new invoices)';
COMMENT ON COLUMN invoice_status_logs.new_status IS 'New status after change';
COMMENT ON COLUMN invoice_status_logs.changed_by IS 'Who made the change (user email, SYSTEM, etc.)';
COMMENT ON COLUMN invoice_status_logs.change_type IS 'Type of change: manual, auto_overdue, payment, system';
COMMENT ON COLUMN invoice_status_logs.payment_info IS 'Payment details when status changes to paid';
COMMENT ON COLUMN invoice_status_logs.metadata IS 'Additional context (browser, IP, etc.)';

-- 8. Grant necessary permissions
GRANT SELECT, INSERT ON invoice_status_logs TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;