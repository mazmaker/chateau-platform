-- Fix role type casting in create_user_with_password function

CREATE OR REPLACE FUNCTION create_user_with_password(
  p_email TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_tenant_id UUID,
  p_role TEXT,
  p_is_active BOOLEAN DEFAULT true
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID;
  v_existing_user UUID;
  v_orphaned_auth_user UUID;
BEGIN
  -- Check if user already exists in this tenant (in public.users)
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

  -- Check if email exists in auth.users but NOT in public.users (orphaned record)
  SELECT id INTO v_orphaned_auth_user
  FROM auth.users
  WHERE email = p_email
    AND id NOT IN (SELECT id FROM users WHERE email = p_email)
  LIMIT 1;

  -- If orphaned auth user exists, delete it first
  IF v_orphaned_auth_user IS NOT NULL THEN
    DELETE FROM auth.users WHERE id = v_orphaned_auth_user;
  END IF;

  -- Create user in Supabase Auth
  -- Get instance_id from first record in auth.instances
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
  )
  SELECT
    (SELECT id FROM auth.instances LIMIT 1),
    gen_random_uuid(),
    p_email,
    crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object(
      'full_name', p_full_name,
      'tenant_id', p_tenant_id,
      'role', p_role
    ),
    '{"provider": "email"}'::jsonb,
    now(),
    now()
  RETURNING id INTO v_user_id;

  -- Create user record in users table
  -- Cast p_role to user_role type
  INSERT INTO users (
    id,
    email,
    full_name,
    tenant_id,
    role,
    is_active,
    created_at
  ) VALUES (
    v_user_id,
    p_email,
    p_full_name,
    p_tenant_id,
    p_role::user_role,
    p_is_active,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', v_user_id,
    'cleaned_orphaned', v_orphaned_auth_user IS NOT NULL
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
GRANT EXECUTE ON FUNCTION create_user_with_password TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_user_with_password IS 'Create a new user with specified password. Automatically cleans up orphaned auth.users records. Role is cast to user_role enum.';
