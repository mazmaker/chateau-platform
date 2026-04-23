-- Migration: Seed test data for development and testing
-- Created: 2026-04-22
-- Purpose: Create sample data for testing the invoice and logging system

-- 1. Create sample tenants (only if they don't exist)
INSERT INTO tenants (name, slug, email, billing_email, subscription_plan, status)
VALUES
  ('CHATEAU Test Company', 'chateau-test', 'test@chateau.test', 'billing@chateau.test', 'professional', 'active'),
  ('Auto Overdue Test', 'auto-overdue-test', 'test@autooverdue.test', 'billing@autooverdue.test', 'starter', 'active'),
  ('Demo Corporation', 'demo-corp', 'demo@example.com', 'accounts@example.com', 'enterprise', 'active')
ON CONFLICT (slug) DO NOTHING;

-- 2. Create sample invoices with different statuses and dates
INSERT INTO invoices (
  tenant_id,
  invoice_number,
  amount,
  currency,
  status,
  subscription_plan,
  due_date,
  description,
  created_at,
  updated_at
)
SELECT
  t.id,
  'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD((ROW_NUMBER() OVER())::text, 4, '0'),
  CASE
    WHEN t.subscription_plan = 'starter' THEN 799.00
    WHEN t.subscription_plan = 'professional' THEN 1490.00
    WHEN t.subscription_plan = 'enterprise' THEN 2990.00
    ELSE 0.00
  END,
  'THB',
  invoice_data.status,
  t.subscription_plan,
  invoice_data.due_date,
  'Test invoice - ' || invoice_data.description,
  invoice_data.created_at,
  invoice_data.updated_at
FROM tenants t
CROSS JOIN (
  VALUES
    -- Current pending invoices
    ('pending', CURRENT_DATE + INTERVAL '7 days', 'Upcoming payment', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('pending', CURRENT_DATE + INTERVAL '14 days', 'Future invoice', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),

    -- Overdue invoices (for auto-detection testing)
    ('pending', CURRENT_DATE - INTERVAL '3 days', 'Should be overdue', NOW() - INTERVAL '33 days', NOW() - INTERVAL '33 days'),
    ('pending', CURRENT_DATE - INTERVAL '1 day', 'Recently overdue', NOW() - INTERVAL '31 days', NOW() - INTERVAL '31 days'),

    -- Paid invoices
    ('paid', CURRENT_DATE - INTERVAL '10 days', 'Completed payment', NOW() - INTERVAL '40 days', NOW() - INTERVAL '25 days'),
    ('paid', CURRENT_DATE - INTERVAL '20 days', 'Early payment', NOW() - INTERVAL '50 days', NOW() - INTERVAL '35 days'),

    -- Cancelled invoices
    ('cancelled', CURRENT_DATE - INTERVAL '5 days', 'Customer cancellation', NOW() - INTERVAL '45 days', NOW() - INTERVAL '30 days')
) AS invoice_data(status, due_date, description, created_at, updated_at)
WHERE t.slug IN ('chateau-test', 'auto-overdue-test', 'demo-corp')
ON CONFLICT (invoice_number) DO NOTHING;

-- 3. Create sample company settings
INSERT INTO company_settings (
  tenant_id,
  company_name,
  billing_automation
)
SELECT
  t.id,
  t.name || ' Ltd.',
  jsonb_build_object(
    'auto_overdue_enabled', true,
    'late_fee_percentage', 10,
    'reminder_days', ARRAY[7, 3, 1],
    'payment_methods', ARRAY['bank_transfer', 'credit_card'],
    'notification_email', t.billing_email
  )
FROM tenants t
WHERE t.slug IN ('chateau-test', 'auto-overdue-test', 'demo-corp')
ON CONFLICT (tenant_id) DO NOTHING;

-- 4. Create sample status logs for demonstration
INSERT INTO invoice_status_logs (
  invoice_id,
  tenant_id,
  old_status,
  new_status,
  changed_by,
  change_type,
  reason,
  notes,
  payment_info,
  metadata,
  created_at
)
SELECT
  i.id,
  i.tenant_id,
  log_data.old_status,
  log_data.new_status,
  log_data.changed_by,
  log_data.change_type,
  log_data.reason,
  log_data.notes,
  log_data.payment_info,
  log_data.metadata,
  i.created_at + log_data.time_offset
FROM invoices i
CROSS JOIN (
  VALUES
    -- Invoice creation logs
    ('', 'pending', 'SYSTEM', 'system', 'Invoice created', 'Automatically generated invoice', NULL, '{"source": "system"}'::jsonb, INTERVAL '0 minutes'),

    -- Manual status changes
    ('pending', 'paid', 'admin@chateau.test', 'manual', 'Payment received', 'Customer paid via bank transfer', '{"method": "bank_transfer", "reference": "TXN123456", "amount": 1490}'::jsonb, '{"browser": "Chrome"}'::jsonb, INTERVAL '25 days'),

    -- Auto overdue changes
    ('pending', 'overdue', 'SYSTEM', 'auto_overdue', 'Exceeded due date', 'Automatically changed to overdue (3 days late)', NULL, '{"days_overdue": 3, "auto_check_time": "2026-04-22T08:00:00Z"}'::jsonb, INTERVAL '30 days'),

    -- Payment after overdue
    ('overdue', 'paid', 'customer@example.com', 'manual', 'Late payment received', 'Customer paid with late fee', '{"method": "credit_card", "reference": "CC789012", "amount": 1639, "late_fee": 149}'::jsonb, '{"browser": "Safari"}'::jsonb, INTERVAL '35 days'),

    -- Cancellation
    ('pending', 'cancelled', 'admin@chateau.test', 'manual', 'Customer requested cancellation', 'Customer no longer needs service', NULL, '{"browser": "Firefox", "ip": "192.168.1.1"}'::jsonb, INTERVAL '20 days')
) AS log_data(old_status, new_status, changed_by, change_type, reason, notes, payment_info, metadata, time_offset)
WHERE i.status IN ('paid', 'cancelled', 'overdue')
  AND NOT EXISTS (
    SELECT 1 FROM invoice_status_logs isl
    WHERE isl.invoice_id = i.id
  )
LIMIT 20; -- Limit to avoid too many logs

-- 5. Create helpful views for debugging and monitoring
CREATE OR REPLACE VIEW invoice_status_summary AS
SELECT
  t.name as tenant_name,
  t.slug,
  i.status,
  COUNT(*) as invoice_count,
  SUM(i.amount) as total_amount,
  AVG(i.amount) as avg_amount
FROM invoices i
JOIN tenants t ON i.tenant_id = t.id
GROUP BY t.name, t.slug, i.status
ORDER BY t.name, i.status;

CREATE OR REPLACE VIEW recent_status_changes AS
SELECT
  l.created_at,
  t.name as tenant_name,
  i.invoice_number,
  l.old_status || ' → ' || l.new_status as status_change,
  l.changed_by,
  l.change_type,
  l.reason
FROM invoice_status_logs l
JOIN invoices i ON l.invoice_id = i.id
JOIN tenants t ON l.tenant_id = t.id
ORDER BY l.created_at DESC
LIMIT 50;

-- 6. Create utility functions
CREATE OR REPLACE FUNCTION get_overdue_invoices()
RETURNS TABLE (
  invoice_id uuid,
  invoice_number varchar(50),
  tenant_name varchar(255),
  amount numeric,
  due_date timestamp with time zone,
  days_overdue integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.invoice_number,
    t.name,
    i.amount,
    i.due_date,
    EXTRACT(DAY FROM (NOW() - i.due_date))::integer
  FROM invoices i
  JOIN tenants t ON i.tenant_id = t.id
  WHERE i.status = 'pending'
    AND i.due_date < NOW()
  ORDER BY i.due_date ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. Add helpful comments
COMMENT ON VIEW invoice_status_summary IS 'Summary of invoice counts and amounts by tenant and status';
COMMENT ON VIEW recent_status_changes IS 'Recent status changes across all invoices';
COMMENT ON FUNCTION get_overdue_invoices() IS 'Returns all currently overdue invoices that need attention';

-- 8. Output summary
DO $$
DECLARE
  tenant_count integer;
  invoice_count integer;
  log_count integer;
BEGIN
  SELECT COUNT(*) INTO tenant_count FROM tenants;
  SELECT COUNT(*) INTO invoice_count FROM invoices;
  SELECT COUNT(*) INTO log_count FROM invoice_status_logs;

  RAISE NOTICE '=== SEEDING COMPLETE ===';
  RAISE NOTICE 'Tenants created: %', tenant_count;
  RAISE NOTICE 'Invoices created: %', invoice_count;
  RAISE NOTICE 'Status logs created: %', log_count;
  RAISE NOTICE '========================';
END $$;