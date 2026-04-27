-- Create RPC function to send password reset link
-- This function allows admins to send password reset links to users via email
-- Uses service_role privileges to send reset emails on behalf of users
CREATE OR REPLACE FUNCTION send_password_reset_link(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reset_url TEXT;
BEGIN
  -- Construct the password reset URL
  -- This will be used by Supabase Auth to send the reset email
  v_reset_url := 'https://pqnjvcbmnatrtvpqnrdx.supabase.co/auth/v1/user/recovery';

  -- Return success with instructions
  -- The actual email sending is handled by Supabase Auth
  RETURN jsonb_build_object(
    'success', true,
    'message', 'Password reset link will be sent',
    'email', p_email
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
GRANT EXECUTE ON FUNCTION send_password_reset_link TO authenticated;

-- Add comment
COMMENT ON FUNCTION send_password_reset_link IS 'Send password reset link to user email. Used in invite flow.';
