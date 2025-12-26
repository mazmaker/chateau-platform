-- Add role to user metadata for display in Supabase Dashboard
-- This makes role visible in Authentication -> Users page

-- Update all existing users to have role in metadata
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(u.role)
)
FROM public.users u
WHERE auth.users.id = u.id;

-- Create function to automatically update metadata when user role changes
CREATE OR REPLACE FUNCTION sync_user_role_to_metadata()
RETURNS TRIGGER AS $$
BEGIN
    -- Update auth.users metadata when public.users role changes
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
        COALESCE(raw_user_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(NEW.role)
    )
    WHERE id = NEW.id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-sync role changes
DROP TRIGGER IF EXISTS on_user_role_change ON public.users;
CREATE TRIGGER on_user_role_change
    AFTER INSERT OR UPDATE OF role ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_user_role_to_metadata();

-- Add comment for documentation
COMMENT ON FUNCTION sync_user_role_to_metadata() IS
'Syncs user role from public.users to auth.users metadata for dashboard display';
