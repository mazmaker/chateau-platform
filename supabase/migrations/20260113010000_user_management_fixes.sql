-- Drop old delete_user_completely function to avoid conflicts
DROP FUNCTION IF EXISTS public.delete_user_completely CASCADE;

-- Fix invite_user_v2 to use URL-safe tokens
CREATE OR REPLACE FUNCTION invite_user_v2(
  p_email TEXT,
  p_full_name TEXT,
  p_tenant_id UUID,
  p_role TEXT,
  p_invited_by UUID,
  p_redirect_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_user RECORD;
  v_user_id UUID;
  v_invite_token TEXT;
BEGIN
  -- Check if user already exists in this tenant
  SELECT * INTO v_existing_user
  FROM users
  WHERE tenant_id = p_tenant_id
    AND email = LOWER(p_email)
  LIMIT 1;

  IF v_existing_user IS NOT NULL THEN
    -- If user exists but is still pending (invited but not accepted)
    IF v_existing_user.is_active = false AND v_existing_user.signup_token IS NOT NULL THEN
      -- Check if token hasn't expired
      IF v_existing_user.signup_expires_at > now() THEN
        -- Return existing invite info
        RETURN jsonb_build_object(
          'success', true,
          'user_id', v_existing_user.id::text,
          'email', v_existing_user.email,
          'signup_token', v_existing_user.signup_token,
          'is_resend', true,
          'message', 'Invite already sent. Use existing token.'
        );
      END IF;
    END IF;

    -- User already exists and is active
    IF v_existing_user.is_active THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User already exists in this tenant'
      );
    END IF;
  END IF;

  -- Generate unique ID for the user
  v_user_id := gen_random_uuid();

  -- Generate a URL-safe signup token using multiple UUIDs
  v_invite_token := replace(gen_random_uuid()::text, '-', '') ||
                    replace(gen_random_uuid()::text, '-', '');

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
    signup_token,
    signup_expires_at,
    created_at
  ) VALUES (
    v_user_id,
    LOWER(p_email),
    p_full_name,
    p_tenant_id,
    p_role::user_role,
    false,
    v_invite_token,
    p_invited_by,
    now(),
    v_invite_token,
    now() + interval '24 hours',
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id::text,
    'email', LOWER(p_email),
    'signup_token', v_invite_token,
    'redirect_url', p_redirect_url
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION invite_user_v2 TO authenticated;

COMMENT ON FUNCTION invite_user_v2 IS 'Create a pending user invite with URL-safe token';
