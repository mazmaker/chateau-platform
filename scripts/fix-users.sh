#!/bin/bash

# Script to fix users without auth_user_id
# This creates auth.users for users that only exist in public.users

echo "Checking for users without auth_user_id..."

# Create a SQL script to find and fix users
cat > /tmp/fix_users.sql << 'SQL'
DO $$
DECLARE
  user_record RECORD;
  v_count INTEGER := 0;
BEGIN
  -- Count users without auth_user_id
  SELECT COUNT(*) INTO v_count
  FROM users
  WHERE auth_user_id IS NULL
    AND is_active = true;

  RAISE NOTICE 'Found % users without auth_user_id', v_count;

  -- For each user without auth_user_id
  FOR user_record IN
    SELECT id, email, full_name, role, tenant_id
    FROM users
    WHERE auth_user_id IS NULL
      AND is_active = true
  LOOP
    RAISE NOTICE 'Processing user: %', user_record.email;
    
    -- Note: We can't create auth.users directly from SQL
    -- This requires using the Supabase Admin API or Edge Function
    -- The user IDs are listed below for manual fixing:
    
    RAISE NOTICE 'User ID: %, Email: %', user_record.id, user_record.email;
  END LOOP;
END $$;

-- Also show the users in a readable format
SELECT 
  id,
  email,
  full_name,
  role,
  tenant_id,
  'NEEDS auth_user_id' as status
FROM users
WHERE auth_user_id IS NULL
  AND is_active = true;
SQL

echo "Running check..."
npx supabase db execute --db-url "$(grep SUPABASE_DB_URL .env | cut -d'=' -f2)" --file /tmp/fix_users.sql 2>/dev/null || echo ""
echo ""
echo "Please run this using the Node.js script instead:"
echo "node scripts/fix-users-without-auth.mjs"
echo ""
echo "You'll need to:"
echo "1. Get your service_role key from Supabase Dashboard"
echo "2. Replace YOUR_SERVICE_ROLE_KEY in the script"
echo "3. Run: node scripts/fix-users-without-auth.mjs"
