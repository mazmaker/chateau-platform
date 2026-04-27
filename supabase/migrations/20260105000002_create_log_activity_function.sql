-- Create log_activity function for tracking user activities
-- This function logs activities to the activity_logs table

CREATE OR REPLACE FUNCTION log_activity(
  p_tenant_id UUID,
  p_user_id UUID,
  p_activity_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_activity_id UUID;
BEGIN
  -- Insert activity log
  INSERT INTO activity_logs (
    tenant_id,
    user_id,
    activity_type,
    description,
    metadata,
    created_at
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_activity_type,
    p_description,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_activity_id;

  RETURN v_activity_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION log_activity TO authenticated;
