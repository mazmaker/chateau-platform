-- Create a function that properly creates auth.users with password
-- This uses the same approach as Supabase Auth but from the database side

-- Main function to accept invite and create user
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
  v_encrypted_password TEXT;
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

  -- Check if this exact ID already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in auth.users with this ID'
    );
  END IF;

  -- Get or create instance_id
  BEGIN
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;

    IF v_instance_id IS NULL THEN
      v_instance_id := gen_random_uuid();
      INSERT INTO auth.instances (id, uuid, raw_app_meta_data)
      VALUES (v_instance_id, gen_random_uuid(), '{"provider": "email"}'::jsonb)
      ON CONFLICT (id) DO NOTHING;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
  END;

  -- Delete any auth.users with SAME email but DIFFERENT id (orphaned records)
  DELETE FROM auth.users
  WHERE email = v_pending_user.email
    AND id != v_user_id;

  -- Hash the password using bcrypt (same as Supabase)
  -- We need to find where gen_salt and crypt are located
  BEGIN
    -- Try extensions schema first (Supabase default)
    v_encrypted_password := extensions.crypt(p_password, extensions.gen_salt('bf'));
  EXCEPTION
    WHEN OTHERS THEN
      BEGIN
        -- Try public schema
        v_encrypted_password := public.crypt(p_password, public.gen_salt('bf'));
      EXCEPTION
        WHEN OTHERS THEN
          -- Last resort - try without schema
          v_encrypted_password := crypt(p_password, gen_salt('bf'));
      END;
  END;

  -- Create user in auth.users with proper password hashing
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
      confirmation_token,
      recovery_token
    ) VALUES (
      v_instance_id,
      v_user_id,
      v_pending_user.email,
      v_encrypted_password,
      now(), -- Mark as confirmed since we're not sending email
      jsonb_build_object(
        'full_name', v_pending_user.full_name,
        'email', v_pending_user.email
      ),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      v_pending_user.created_at,
      now(),
      '',
      ''
    );
  EXCEPTION
    WHEN unique_violation THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'User already exists with this email'
      );
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

  -- Return success - user can now sign in
  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id::text,
    'email', v_pending_user.email,
    'message', 'User created successfully. You can now sign in.'
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
