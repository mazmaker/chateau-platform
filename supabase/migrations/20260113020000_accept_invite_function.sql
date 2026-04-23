-- Create function to accept invite and set password in one go
-- This allows users to complete signup without needing to login with temp password first

CREATE OR REPLACE FUNCTION accept_invite_and_create_user(
  p_invite_token TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pending_user RECORD;
  v_auth_user_id UUID;
  v_temp_password TEXT;
BEGIN
  -- Find pending user by invite/signup token
  SELECT * INTO v_pending_user
  FROM users
  WHERE invite_token = p_invite_token OR signup_token = p_invite_token
  LIMIT 1;

  IF v_pending_user IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite link'
    );
  END IF;

  -- Check if already active
  IF v_pending_user.is_active THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This invite has already been accepted'
    );
  END IF;

  -- Check if token has expired
  IF v_pending_user.signup_expires_at < now() THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invite link has expired'
    );
  END IF;

  -- Generate temp password (we'll update it immediately)
  v_temp_password := gen_random_uuid()::text;

  -- Create user in auth.users using Admin API
  -- Note: This won't work directly from SQL - we need to return info for Edge Function
  -- For now, just prepare the data and return
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_pending_user.id::text,
    'email', v_pending_user.email,
    'full_name', v_pending_user.full_name,
    'tenant_id', v_pending_user.tenant_id::text,
    'role', v_pending_user.role::text,
    'temp_password', v_temp_password,
    'message', 'User info retrieved - Edge Function will create auth user'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated and anon
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO anon;

COMMENT ON FUNCTION accept_invite_and_create_user IS 'Retrieve pending user info for signup - actual auth.user creation happens in Edge Function';
