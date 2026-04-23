-- Fix invite_user function - use simpler token generation without encode()

CREATE OR REPLACE FUNCTION invite_user(
  p_email TEXT,
  p_full_name TEXT,
  p_tenant_id UUID,
  p_role TEXT,
  p_invited_by UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_user UUID;
  v_invite_token TEXT;
  v_user_id TEXT;
BEGIN
  -- Check if user already exists in this tenant
  SELECT id INTO v_existing_user
  FROM users
  WHERE tenant_id = p_tenant_id
    AND email = p_email
  LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in this tenant'
    );
  END IF;

  -- Generate simple invite token using md5
  v_invite_token := lower(md5(random()::text || clock_timestamp()::text || p_email || random()::text));
  v_user_id := gen_random_uuid()::text;

  -- Create pending user record
  INSERT INTO users (
    id,
    email,
    full_name,
    tenant_id,
    role,
    is_active,
    invite_token,
    invited_by,
    invited_at,
    created_at
  ) VALUES (
    v_user_id::uuid,
    p_email,
    p_full_name,
    p_tenant_id,
    p_role::user_role,
    false, -- not active until they signup
    v_invite_token,
    p_invited_by,
    now(),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'invite_token', v_invite_token
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION invite_user TO authenticated;
