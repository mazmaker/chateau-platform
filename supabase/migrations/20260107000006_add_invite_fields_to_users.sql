-- Add invite-related columns to users table

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invite_token TEXT,
  ADD COLUMN IF NOT EXISTS invited_by UUID,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_accepted_at TIMESTAMPTZ;

-- Create index on invite_token for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL;

-- Add comments
COMMENT ON COLUMN users.invite_token IS 'Token for email verification when user accepts invite';
COMMENT ON COLUMN users.invited_by IS 'ID of user who sent the invite';
COMMENT ON COLUMN users.invited_at IS 'When the invite was sent';
COMMENT ON COLUMN users.invite_expires_at IS 'When the invite expires';
COMMENT ON COLUMN users.invite_accepted_at IS 'When the user accepted the invite';
