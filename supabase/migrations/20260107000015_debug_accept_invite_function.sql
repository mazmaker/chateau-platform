-- Create a test/debug version to see what's happening

CREATE OR REPLACE FUNCTION test_accept_invite(
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
  v_debug_info JSONB;
BEGIN
  -- Initialize debug info
  v_debug_info := jsonb_build_object(
    'step', 'start',
    'token', p_invite_token
  );

  -- Find pending user by invite token
  v_debug_info := v_debug_info || jsonb_build_object('step', 'finding_user');

  SELECT * INTO v_pending_user
  FROM users
  WHERE invite_token = p_invite_token
    AND is_active = false
  LIMIT 1;

  IF v_pending_user IS NULL THEN
    v_debug_info := v_debug_info || jsonb_build_object('error', 'user_not_found');
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or expired invite token',
      'debug', v_debug_info
    );
  END IF;

  v_debug_info := v_debug_info || jsonb_build_object(
    'step', 'user_found',
    'user_id', v_pending_user.id::text,
    'email', v_pending_user.email
  );

  -- Use the existing ID from pending user
  v_user_id := v_pending_user.id;

  -- Check if user already exists in auth.users
  v_debug_info := v_debug_info || jsonb_build_object('step', 'checking_existing');

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    v_debug_info := v_debug_info || jsonb_build_object('error', 'user_exists_in_auth');
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in auth.users',
      'debug', v_debug_info
    );
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_pending_user.email AND id != v_user_id) THEN
    v_debug_info := v_debug_info || jsonb_build_object('error', 'email_exists_in_auth');
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email already registered in auth.users',
      'debug', v_debug_info
    );
  END IF;

  -- Get instance_id
  v_debug_info := v_debug_info || jsonb_build_object('step', 'getting_instance');

  BEGIN
    SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;

    IF v_instance_id IS NULL THEN
      v_debug_info := v_debug_info || jsonb_build_object('instance_action', 'creating_new');
      v_instance_id := gen_random_uuid();
      BEGIN
        INSERT INTO auth.instances (id, uuid, raw_app_meta_data)
        VALUES (v_instance_id, gen_random_uuid(), '{"provider": "email"}'::jsonb);
      EXCEPTION
        WHEN OTHERS THEN
          SELECT id INTO v_instance_id FROM auth.instances LIMIT 1;
      END;
    ELSE
      v_debug_info := v_debug_info || jsonb_build_object('instance_action', 'found_existing');
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      v_instance_id := gen_random_uuid();
      v_debug_info := v_debug_info || jsonb_build_object('instance_action', 'error_fallback');
  END;

  v_debug_info := v_debug_info || jsonb_build_object('instance_id', v_instance_id::text);

  -- Create user in auth.users
  v_debug_info := v_debug_info || jsonb_build_object('step', 'creating_auth_user');

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

    v_debug_info := v_debug_info || jsonb_build_object('step', 'auth_user_created');
  EXCEPTION
    WHEN OTHERS THEN
      v_debug_info := v_debug_info || jsonb_build_object(
        'error', 'auth_insert_failed',
        'sql_error', SQLERRM
      );
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Failed to create auth user: ' || SQLERRM,
        'debug', v_debug_info
      );
  END;

  -- Update public.users
  v_debug_info := v_debug_info || jsonb_build_object('step', 'updating_public_user');

  UPDATE users
  SET
    is_active = true,
    invite_token = NULL,
    invite_accepted_at = now()
  WHERE id = v_user_id;

  v_debug_info := v_debug_info || jsonb_build_object('step', 'done');

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id::text,
    'email', v_pending_user.email,
    'debug', v_debug_info
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'debug', v_debug_info || jsonb_build_object('exception', SQLERRM)
    );
END;
$$;

-- Grant execute
GRANT EXECUTE ON FUNCTION test_accept_invite TO authenticated;
GRANT EXECUTE ON FUNCTION test_accept_invite TO anon;

-- Also update the main function with better error handling
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

  -- Check if user already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User already exists in auth.users'
    );
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_pending_user.email AND id != v_user_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email already registered in auth.users'
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

  -- Create user in auth.users using the SAME ID as public.users
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

  -- Update the user record to mark as active and clear invite token
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
