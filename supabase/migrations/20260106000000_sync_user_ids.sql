-- ============================================================================
-- Sync User IDs Migration
-- ============================================================================
-- This migration updates public.users to use the same ID as auth.users
-- This is the best practice approach recommended by Supabase
--
-- Benefits:
--   - No ID mismatch issues
--   - Faster lookups (no need to query by email)
--   - Aligns with Supabase official recommendations
-- ============================================================================

-- Step 1: Add auth_id column temporarily to track the mapping
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS auth_id UUID;

-- Step 2: Map existing auth user IDs to public users by email
UPDATE public.users
SET auth_id = auth.users.id
FROM auth.users
WHERE public.users.email = auth.users.email
AND public.users.id != auth.users.id;

-- Step 3: Create a backup of the old IDs (for safety)
-- This stores the old IDs in case we need to rollback
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS old_id UUID;

UPDATE public.users
SET old_id = id
WHERE old_id IS NULL;

-- Step 4: Update public.users.id to match auth.users.id
-- Only update users where we found a matching auth user
UPDATE public.users
SET id = auth_id
WHERE auth_id IS NOT NULL
AND id != auth_id;

-- Step 5: Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Step 6: Add comment for documentation
COMMENT ON COLUMN public.users.auth_id IS 'Temporary column for ID migration. Can be removed after verification.';
COMMENT ON COLUMN public.users.old_id IS 'Backup of original public.users ID before sync with auth.users. Keep for safety.';

-- ============================================================================
-- Verification Query (run this to check results)
-- ============================================================================
-- This query shows how many users were successfully synced:
-- SELECT
--   COUNT(*) as total_users,
--   COUNT(CASE WHEN id = auth_id THEN 1 END) as synced_users,
--   COUNT(CASE WHEN id != auth_id OR auth_id IS NULL THEN 1 END) as unsynced_users
-- FROM public.users;
