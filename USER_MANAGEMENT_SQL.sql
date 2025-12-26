-- ====================================================================
-- 🚀 USER MANAGEMENT DATABASE FUNCTIONS
-- ====================================================================
-- Run this in Supabase SQL Editor to add functions for User Management

-- Function to get user by email
CREATE OR REPLACE FUNCTION public.get_user_by_email(p_email text)
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    u.email,
    u.created_at
  FROM auth.users u
  WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.get_user_by_email TO authenticated;

-- Function to send invitation (for future email integration)
CREATE OR REPLACE FUNCTION public.send_user_invitation(p_user_id uuid, p_tenant_id uuid, p_temp_password text)
RETURNS boolean AS $$
DECLARE
    user_email text;
    tenant_name text;
BEGIN
    -- Get user email and tenant name
    SELECT u.email, t.name
    INTO user_email, tenant_name
    FROM auth.users u
    JOIN tenants t ON t.id = p_tenant_id
    WHERE u.id = p_user_id;

    -- In a real implementation, this would send an email
    -- For now, we'll just return true
    -- Email service integration point here

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.send_user_invitation TO authenticated;

-- Add audit log for user management
CREATE OR REPLACE FUNCTION public.log_user_management(
    p_action text,
    p_tenant_id uuid,
    p_user_id uuid,
    p_target_user_id uuid DEFAULT NULL,
    p_old_values jsonb DEFAULT NULL,
    p_new_values jsonb DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO audit_logs (
        tenant_id,
        user_id,
        action,
        entity_type,
        entity_id,
        old_values,
        new_values,
        created_at
    ) VALUES (
        p_tenant_id,
        p_user_id,
        p_action,
        'user_tenant',
        p_target_user_id,
        p_old_values,
        p_new_values,
        NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permission
GRANT EXECUTE ON FUNCTION public.log_user_management TO authenticated;

COMMIT;