-- Add password reset required field for temporary password system
-- This forces users to change password on first login

-- Add column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_reset_required BOOLEAN DEFAULT TRUE;

-- Add first_login_at to track when user first logged in
ALTER TABLE users
ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ NULL;

-- Update existing users
UPDATE users
SET password_reset_required = CASE
  WHEN role = 'owner' THEN FALSE
  ELSE TRUE
END;

-- Comment for future reference
COMMENT ON COLUMN users.password_reset_required IS 'TRUE if user must change password on next login (for temporary passwords)';
COMMENT ON COLUMN users.first_login_at IS 'Timestamp when user first logged in successfully';