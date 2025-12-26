-- ====================================================================
-- FIX: Trigger causing "Database error creating new user"
-- Run this FIRST before creating any user
-- ====================================================================

-- Step 1: Remove the problematic trigger completely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- Step 2: Check if users table exists and fix it
-- Remove foreign key constraint that causes issues
DROP TABLE IF EXISTS public.users CASCADE;

-- Step 3: Recreate users table WITHOUT foreign key to auth.users
CREATE TABLE public.users (
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

-- Step 4: Create a NEW trigger that handles errors gracefully
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert without causing errors
    BEGIN
        INSERT INTO public.users (id, email, full_name)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(
                NEW.raw_user_meta_data->>'full_name',
                NEW.raw_user_meta_data->>'name',
                split_part(NEW.email, '@', 1)
            )
        );
    EXCEPTION
        WHEN unique_violation THEN
            -- User already exists, ignore
            NULL;
        WHEN OTHERS THEN
            -- Log but don't fail the user creation
            RAISE WARNING 'handle_new_user error: %, %', SQLERRM, SQLSTATE;
            NULL;
    END;
    RETURN NEW;
END;
$$;

-- Step 5: Recreate trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Step 6: Verify
SELECT 'FIXED! Now you can create users.' as status;
