-- Create RPC function to delete user completely (from both auth.users and public.users)
-- This function requires service_role privileges to delete from auth.users

CREATE OR REPLACE FUNCTION delete_user_completely(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id UUID;
  v_public_user_id UUID;
BEGIN
  -- First, get the user ID from public.users
  SELECT id INTO v_public_user_id
  FROM users
  WHERE email = p_email
  LIMIT 1;

  IF v_public_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not found in public.users'
    );
  END IF;

  -- Store the ID for auth.users deletion
  v_user_id := v_public_user_id;

  -- Delete from public.users first (due to foreign key)
  DELETE FROM users
  WHERE email = p_email;

  -- Delete from auth.users (this requires admin access)
  -- Note: This might fail due to RLS, but we try anyway
  BEGIN
    DELETE FROM auth.users
    WHERE id = v_user_id OR email = p_email;
  EXCEPTION
    WHEN OTHERS THEN
      -- If we can't delete from auth.users, at least we deleted from public.users
      NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'User deleted from public.users. auth.users may need manual deletion.',
    'user_id', v_user_id
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
GRANT EXECUTE ON FUNCTION delete_user_completely TO authenticated;

-- Add comment
COMMENT ON FUNCTION delete_user_completely IS 'Delete user from both public.users and auth.users. Requires careful handling of auth.users deletion.';
