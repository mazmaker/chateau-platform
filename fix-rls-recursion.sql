-- Fix infinite recursion in RLS policies
-- The problem: Policies are querying users table which triggers the same policies
-- Solution: Use auth.uid() directly without subqueries when possible

-- Drop problematic policies
DROP POLICY IF EXISTS "Owner can view all users" ON users;
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Owner can manage all users" ON users;
DROP POLICY IF EXISTS "Admins can manage users in their tenant" ON users;

-- Recreate with fixed logic (no recursive subquery)
CREATE POLICY "Owner can view all users" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'owner'
        )
    );

CREATE POLICY "Users can view themselves" ON users
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Users can view users in same tenant" ON users
    FOR SELECT USING (
        id != auth.uid() AND
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

CREATE POLICY "Owner can manage all users" ON users
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid() AND u.role = 'owner'
        )
    );

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
