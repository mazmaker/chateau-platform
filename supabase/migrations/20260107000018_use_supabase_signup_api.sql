-- New approach: Don't create auth.users directly with crypt()
-- Instead, mark the user as ready and let the frontend use supabase.auth.signUp()
-- Then update the user record to link the IDs

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
  v_user_id UUID;
BEGIN
  -- Find pending user by invite token
  SELECT * INTO v_pending_user
  FROM users
  WHERE invite_token = p_invite_token
    AND is_active = false
  LIMIT 1;

  IF v_pending_user IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite token'
    );
  END IF;

  v_user_id := v_pending_user.id;

  -- Check if user already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_pending_user.email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email already registered in auth.users'
    );
  END IF;

  -- Return success with user info
  -- Frontend will use supabase.auth.signUp() which properly creates auth.users
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id::text,
    'email', v_pending_user.email,
    'full_name', v_pending_user.full_name,
    'message', 'Use supabase.auth.signUp() in frontend'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO anon;
