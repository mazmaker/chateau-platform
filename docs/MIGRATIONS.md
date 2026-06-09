# Database Migrations for Epic 0 Authentication System

## 🚨 Important: Run These Migrations Manually

Since we don't have direct CLI access to the Supabase project, please run these migrations manually in the Supabase Dashboard:

### 1. Go to Supabase SQL Editor
- Open: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
- Make sure you're logged in with admin access

### 2. Run Migration 1: Fix Authentication Schema
Copy and paste the entire content of `supabase/migrations/20250122000000_fix_auth_schema.sql`

**Key changes in this migration:**
- ✅ Creates `user_tenants` table for proper multi-tenant relationships
- ✅ Updates `user_role` enum to match frontend (`owner`, `admin`, `sales`, `viewer`)
- ✅ Adds `metadata` field to `users` table for `user_metadata`
- ✅ Adds white-labeling fields to `tenants` table
- ✅ Creates RPC functions for tenant management
- ✅ Updates RLS policies for new schema
- ✅ Inserts demo data for testing

### 3. Run Migration 2: Update Business Tables
Copy and paste the entire content of `supabase/migrations/20250122000001_update_business_tables.sql`

**Key changes in this migration:**
- ✅ Updates RLS policies to use `user_tenants` system
- ✅ Fixes permissions for new role structure
- ✅ Adds foreign key constraints
- ✅ Creates performance indexes
- ✅ Inserts demo properties and customers

### 4. Verify Migration Success

After running both migrations, run this verification query:

```sql
-- Check if new tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('user_tenants', 'tenants', 'users', 'properties', 'customers', 'bookings')
ORDER BY table_name;

-- Check if new user_tenants table has data
SELECT ut.*, t.name as tenant_name, u.email
FROM user_tenants ut
JOIN tenants t ON ut.tenant_id = t.id
JOIN auth.users u ON ut.user_id = u.id
LIMIT 5;

-- Check if tenant has white-labeling fields
SELECT name, subscription_plan, primary_color, logo_url FROM tenants LIMIT 3;

-- Check if users have metadata field
SELECT id, email, metadata FROM users LIMIT 3;
```

### 5. Test Authentication System

Once migrations are complete, test the authentication:

1. **Register new user:**
   - Go to http://localhost:5175/auth/register
   - Create a new account
   - Should automatically create a tenant

2. **Login:**
   - Go to http://localhost:5175/auth/login
   - Login with the new account
   - Should redirect to dashboard

3. **Check tenant switching:**
   - Look for tenant switcher in header
   - Should show organization name

### 6. Expected Database Structure After Migration

#### `user_tenants` Table (NEW)
```sql
- id (uuid, primary key)
- user_id (uuid, foreign key to auth.users)
- tenant_id (uuid, foreign key to tenants)
- role (enum: owner, admin, sales, viewer)
- is_active (boolean)
- invited_by (uuid, nullable)
- invited_at (timestamptz, nullable)
- joined_at (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `users` Table (UPDATED)
```sql
- id (uuid, primary key, references auth.users)
- email (text, unique)
- full_name (text, nullable)
- avatar_url (text, nullable)
- phone (text, nullable)
- metadata (jsonb, default '{}') ← NEW
- email_verified (boolean, default false) ← NEW
- last_sign_in_at (timestamptz, nullable)
- created_at (timestamptz)
- updated_at (timestamptz)
```

#### `tenants` Table (UPDATED)
```sql
- id (uuid, primary key)
- name (text)
- slug (citext, unique)
- domain (citext, nullable)
- status (enum: trial, active, suspended, cancelled)
- subscription_plan (enum: free, professional, enterprise) ← UPDATED
- max_properties (integer, default 5)
- settings (jsonb, default '{}')
- logo_url (text, nullable) ← NEW
- primary_color (varchar(7), default '#4f46e5') ← NEW
- secondary_color (varchar(7), default '#7c3aed') ← NEW
- custom_domain (text, nullable) ← NEW
- billing_email (text, nullable) ← NEW
- trial_ends_at (timestamptz, nullable) ← NEW
- subscription_current_period_start (timestamptz, nullable) ← NEW
- subscription_current_period_end (timestamptz, nullable) ← NEW
- created_at (timestamptz)
- updated_at (timestamptz)
```

### 7. Troubleshooting

If you encounter errors:

1. **"Table already exists"**: Drop and recreate
   ```sql
   DROP TABLE IF EXISTS user_tenants CASCADE;
   ```

2. **"Enum already exists"**: Drop and recreate
   ```sql
   DROP TYPE IF EXISTS user_role;
   CREATE TYPE user_role AS ENUM ('owner', 'admin', 'sales', 'viewer');
   ```

3. **"Policy already exists"**: Drop and recreate
   ```sql
   DROP POLICY IF EXISTS "policy_name" ON table_name;
   ```

4. **Function errors**: Make sure to run the migrations in order

### 8. Success Indicators

✅ Migrations successful when:
- All tables exist with correct structure
- Demo data is present (1 demo tenant, 1 demo user)
- RLS policies are active
- Can register new users successfully
- New users get automatic tenant assignment
- Frontend authentication works without console errors

---

**Next Steps After Migration:**
1. Test user registration flow
2. Test login and tenant switching
3. Verify dashboard loads correctly
4. Test user settings page
5. Continue with Company Settings (White-label) implementation