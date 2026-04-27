-- Add billing_settings support to tenants table
-- Fix for profiles table 403 error

-- Add billing_settings column to tenants table if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'tenants' AND column_name = 'billing_settings'
    ) THEN
        ALTER TABLE tenants ADD COLUMN billing_settings jsonb DEFAULT '{}';
    END IF;
END $$;

-- Update existing tenants to have default billing settings
UPDATE tenants
SET billing_settings = '{
  "scheduler": {
    "timezone": "Asia/Bangkok",
    "businessHours": {"start": "08:00", "end": "18:00"},
    "holidays": ["2024-01-01", "2024-12-25"],
    "retryPolicy": {
      "enabled": true,
      "maxRetries": 3,
      "backoffStrategy": "exponential",
      "backoffBase": 2
    }
  },
  "email": {
    "fromName": "CHATEAU Platform",
    "fromEmail": "billing@chateau-platform.com",
    "replyTo": "support@chateau-platform.com",
    "enableTracking": true,
    "enableA11yMode": false
  },
  "billing": {
    "invoicePrefix": "INV",
    "gracePeriodDays": 7,
    "autoSuspendAfterDays": 14,
    "currency": "THB",
    "taxRate": 0.07,
    "paymentTerms": "NET 7"
  },
  "notifications": {
    "enableAdminEmail": true,
    "adminEmail": "admin@chateau-platform.com"
  }
}'::jsonb
WHERE billing_settings IS NULL OR billing_settings = '{}'::jsonb;

-- Add RLS policy for billing_settings access
DROP POLICY IF EXISTS "Users can read tenant billing_settings" ON tenants;
DROP POLICY IF EXISTS "Users can update tenant billing_settings" ON tenants;

CREATE POLICY "Users can read tenant billing_settings" ON tenants
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.tenant_id = tenants.id
            AND u.id = auth.uid()
            AND u.role IN ('owner', 'admin')
        )
    );

CREATE POLICY "Users can update tenant billing_settings" ON tenants
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.tenant_id = tenants.id
            AND u.id = auth.uid()
            AND u.role = 'owner'
        )
    );

-- Create function to get billing settings for current user
CREATE OR REPLACE FUNCTION get_billing_settings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tenant_id uuid;
    settings jsonb;
BEGIN
    -- Get user's tenant_id
    SELECT tenant_id INTO user_tenant_id
    FROM users
    WHERE id = auth.uid();

    IF user_tenant_id IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    -- Get billing settings
    SELECT billing_settings INTO settings
    FROM tenants
    WHERE id = user_tenant_id;

    RETURN COALESCE(settings, '{}'::jsonb);
END;
$$;

-- Create function to update billing settings
CREATE OR REPLACE FUNCTION update_billing_settings(new_settings jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_tenant_id uuid;
    user_role text;
BEGIN
    -- Get user's tenant_id and role
    SELECT tenant_id, role::text INTO user_tenant_id, user_role
    FROM users
    WHERE id = auth.uid();

    -- Only owners can update billing settings
    IF user_role != 'owner' THEN
        RAISE EXCEPTION 'Only owners can update billing settings';
    END IF;

    -- Update settings
    UPDATE tenants
    SET billing_settings = new_settings,
        updated_at = now()
    WHERE id = user_tenant_id;

    RETURN TRUE;
END;
$$;