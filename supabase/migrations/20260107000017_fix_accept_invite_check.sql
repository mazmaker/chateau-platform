-- Fix the accept_invite_and_create_user function
-- The issue is the EXISTS check might be finding users by email with different IDs

-- Let's create a simpler version that doesn't check for email duplicates
-- Only check if the SAME ID already exists

CREATE OR REPLACE FUNCTION accept_invite_and_create_user(
  p_invite_token TEXT,
  p_password TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
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

  -- Use the existing ID from pending user
  v_user_id := v_pending_user.id;

  -- ONLY check if this exact ID already exists in auth.users
  -- Don't check for email duplicates - let us recreate the auth user
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in auth.users with this ID'
    );
  END IF;

  -- Get instance_id
  BEGIN
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;

    IF v_instance_id IS NULL THEN
      v_instance_id := gen_random_uuid();
      BEGIN
        INSERT INTO auth.instances (id, uuid, raw_app_meta_data)
        VALUES (v_instance_id, gen_random_uuid(), '{"provider": "email"}'::jsonb);
      EXCEPTION
        WHEN OTHERS THEN
          SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
      END;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
    v_instance_id := gen_random_uuid();
  END;

  -- First, delete any auth.users with SAME email but DIFFERENT id
  -- This handles the case where auth.users has an orphaned record
  DELETE FROM auth.users
  WHERE email = v_pending_user.email
    AND id != v_user_id;

  -- Create user in auth.users
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_user_meta_data,
      raw_app_meta_data,
      created_at,
      updated_at,
      confirmation_token
    ) VALUES (
      v_instance_id,
      v_user_id,
      v_pending_user.email,
      crypt(p_password, gen_salt('bf')),
      now(),
      jsonb_build_object('full_name', v_pending_user.full_name),
      '{"provider": "email"}'::jsonb,
      v_pending_user.created_at,
      now(),
      ''
    );
  EXCEPTION
    WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to create auth user: ' || SQLERRM
    );
  END;

  -- Update public.users to active
  UPDATE users
  SET
    is_active = true,
    invite_token = NULL,
    invite_accepted_at = now()
  WHERE id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id::text,
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

-- Grant execute
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO authenticated;
GRANT EXECUTE ON FUNCTION accept_invite_and_create_user TO anon;
