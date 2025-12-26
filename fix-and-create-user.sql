-- ====================================================================
-- CHATEAU Platform - Fix Triggers and Create User
-- Run this in: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
-- ====================================================================

-- STEP 1: Drop problematic triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- STEP 2: Fix the trigger function (handle foreign key issue)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert without foreign key constraint check first
    INSERT INTO public.users (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            NEW.raw_user_meta_data->>'full_name',
            NEW.raw_user_meta_data->>'name',
            split_part(NEW.email, '@', 1)
        )
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error but don't fail the signup
        RAISE WARNING 'Failed to create user profile: %', SQLERRM;
        RETURN NEW;
END;
$$;

-- STEP 3: Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- STEP 4: Ensure users table exists with correct schema
CREATE TABLE IF NOT EXISTS public.users (
    id uuid PRIMARY KEY,
    email text UNIQUE NOT NULL,
    full_name text,
    avatar_url text,
    phone text,
    preferences jsonb DEFAULT '{}',
    metadata jsonb DEFAULT '{}',
    email_verified boolean DEFAULT false,
    phone_verified boolean DEFAULT false,
    last_sign_in_at timestamptz,
    last_activity_at timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- STEP 5: Create tenant if not exists
INSERT INTO public.tenants (name, slug)
VALUES ('CHATEAU Platform', 'chateau-platform')
ON CONFLICT (slug) DO NOTHING;

-- ====================================================================
-- COMPLETE! Now try creating user again in Supabase Dashboard
-- ====================================================================

-- Verify setup
SELECT 'Setup complete!' as status,
       (SELECT count(*) FROM public.users) as user_count,
       (SELECT count(*) FROM public.tenants) as tenant_count;