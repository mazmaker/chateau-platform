-- Fix RLS policies to allow initial setup
-- Run this in: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their tenant" ON tenants;
DROP POLICY IF EXISTS "Service role can do anything on tenants" ON tenants;

-- Create new policies that allow insert for authenticated users
CREATE POLICY "Allow authenticated to insert" ON tenants
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow authenticated to select" ON tenants
    FOR SELECT
    TO authenticated
    USING (true);

-- Fix user_tenants policies too
DROP POLICY IF EXISTS "Users can view their memberships" ON user_tenants;
DROP POLICY IF EXISTS "Service role can do anything on user_tenants" ON user_tenants;

CREATE POLICY "Allow authenticated to manage memberships" ON user_tenants
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

SELECT 'RLS Fixed!' as status;
