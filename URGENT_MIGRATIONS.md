# 🚨 URGENT: Database Migrations Required

## Status Report
✅ **Frontend Authentication System**: COMPLETE
❌ **Database Schema**: NEEDS MANUAL MIGRATIONS
❌ **Current Issue**: RLS policies have infinite recursion, `user_tenants` table missing

---

## 🔥 IMMEDIATE ACTION REQUIRED

The verification script revealed critical database schema issues that must be fixed **before** the authentication system can work:

### Issues Found:
1. ❌ `user_tenants` table does not exist (CRITICAL)
2. ❌ Missing white-labeling columns in `tenants` table
3. ❌ RLS policies causing infinite recursion
4. ❌ Missing `metadata` column in `users` table

---

## 📋 Step-by-Step Migration Guide

### 1. Open Supabase SQL Editor
👉 **Go to**: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql

### 2. Run First Migration: Fix Authentication Schema

Copy the **ENTIRE** content of this file:
```
supabase/migrations/20250122000000_fix_auth_schema.sql
```

And paste it into the SQL Editor, then click **RUN**.

**What this migration does:**
- ✅ Drops problematic old triggers/policies
- ✅ Creates `user_tenants` table (CRITICAL)
- ✅ Updates `user_role` enum to match frontend
- ✅ Adds `metadata` column to `users` table
- ✅ Adds white-labeling fields to `tenants`
- ✅ Creates proper RLS policies
- ✅ Adds RPC functions for tenant management

### 3. Run Second Migration: Update Business Tables

Copy the **ENTIRE** content of this file:
```
supabase/migrations/20250122000001_update_business_tables.sql
```

And paste it into the SQL Editor, then click **RUN**.

**What this migration does:**
- ✅ Fixes RLS policies to use new `user_tenants` system
- ✅ Updates permissions for new role structure
- ✅ Adds proper foreign key constraints
- ✅ Creates performance indexes
- ✅ Inserts demo data for testing

### 4. Verify Success

After running both migrations, run this verification query:

```sql
-- Check if user_tenants table exists and has data
SELECT
    ut.id,
    u.email,
    t.name as tenant_name,
    ut.role,
    ut.created_at
FROM user_tenants ut
JOIN auth.users u ON ut.user_id = u.id
JOIN tenants t ON ut.tenant_id = t.id
LIMIT 5;

-- Check new columns exist
SELECT
    name,
    subscription_plan,
    primary_color,
    logo_url,
    billing_email
FROM tenants
LIMIT 3;

-- Check users table has metadata
SELECT
    email,
    metadata,
    email_verified
FROM users
LIMIT 3;
```

### 5. Test the System

1. **Open Browser**: http://localhost:5175
2. **Register**: Go to `/auth/register` and create a new account
3. **Login**: Use the new credentials
4. **Check Dashboard**: Should load without errors
5. **Verify Tenant Switcher**: Look in header for organization dropdown

---

## 🚨 What Happens If You Don't Run Migrations

Without these migrations, you'll see:
- ❌ Login redirects to blank page
- ❌ Console errors about missing `user_tenants`
- ❌ Infinite recursion errors in Supabase
- ❌ Authentication context never loads
- ❌ Dashboard never displays

---

## 🛠️ Troubleshooting

### If you see errors during migration:

**"Table already exists" error:**
```sql
DROP TABLE IF EXISTS user_tenants CASCADE;
-- Then re-run the migration
```

**"Enum already exists" error:**
```sql
DROP TYPE IF EXISTS user_role CASCADE;
-- Then re-run the migration
```

**"Policy already exists" error:**
```sql
DROP POLICY IF EXISTS "policy_name" ON "table_name";
-- Then re-run the migration
```

**"Infinite recursion" error:**
This means the old RLS policies are still active. Run the full migration to fix this.

---

## 📞 Support

If you encounter issues:
1. **Check console errors** in browser dev tools
2. **Run verification script**: `node scripts/verify-schema.js`
3. **Check Supabase logs** in dashboard
4. **Verify both migrations ran completely**

---

## ✅ Success Checklist

After migrations, verify:

- [ ] No "user_tenants table does not exist" errors
- [ ] No "infinite recursion" errors
- [ ] Can register new users successfully
- [ ] New users get automatic tenant creation
- [ ] Login redirects to dashboard correctly
- [ ] Dashboard loads without console errors
- [ ] Tenant switcher appears in header
- [ ] User settings page works

---

**⏰ Estimated Time**: 10-15 minutes to run migrations and test

**🎯 Priority**: CRITICAL - System will not function without these migrations