-- Fix accept_invite_and_create_user - handle missing auth.instances

CREATE OR REPLACE FUNCTION accept_invite_and_create_user(
  p_invite_token TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_pending_user RECORD;
  v_user_id UUID;
  v_instance_id UUID;
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

  -- Check if user already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_pending_user.email) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in auth.users'
    );
  END IF;

  -- Get instance_id - handle missing instances table
  BEGIN
    SELECT id INTO v_instance_id
    FROM auth.instances
    LIMIT 1;

    IF v_instance_id IS NULL THEN
      -- Create a default instance if none exists
      v_instance_id := gen_random_uuid();

      -- Try to insert the instance (may fail due to permissions, but that's ok)
      BEGIN
        INSERT INTO auth.instances (id, uuid, raw_app_meta_data)
        VALUES (v_instance_id, gen_random_uuid(), '{"provider": "email"}'::jsonb);
      EXCEPTION
        WHEN OTHERS THEN
          -- If we can't create instance, try to use existing one
          SELECT id INTO v_instance_id
          FROM auth.instances
          LIMIT 1;
      END;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- If instances table doesn't exist or other error, use a generated UUID
      v_instance_id := gen_random_uuid();
  END;

  -- Create user in auth.users directly
  v_user_id := gen_random_uuid();

  INSERT INTO auth.users (
    instance_id,
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at
  ) VALUES (
    v_instance_id,
    v_user_id,
    v_pending_user.email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('full_name', v_pending_user.full_name),
    '{"provider": "email"}'::jsonb,
    now(),
    now()
  );

  -- Update the pending user record with the new auth user ID and mark as active
  UPDATE users
  SET
    id = v_user_id,
    is_active = true,
    invite_token = NULL,
    invite_accepted_at = now()
  WHERE id = v_pending_user.id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'email', v_pending_user.email
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute to authenticated and anon users (for signup flow)
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO anon;

-- Add comment
COMMENT ON FUNCTION accept_invite_and_create_user IS 'Accept invite and create user with password in both auth.users and public.users';
