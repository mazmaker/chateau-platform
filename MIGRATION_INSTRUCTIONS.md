# CHATEAU Platform - Database Migration Instructions

## 🎯 Objective
Set up the complete database schema for CHATEAU Platform to support multi-tenant architecture with proper RLS policies.

## 📋 Prerequisites
- Access to Supabase dashboard: https://pqnjvcbmnatrtvpqnrdx.supabase.co
- Admin permissions on the Supabase project

## 🚀 Migration Steps

### Step 1: Open Supabase SQL Editor
1. Go to: https://pqnjvcbmnatrtvpqnrdx.supabase.co/project/sql
2. Login with your Supabase credentials

### Step 2: Copy Migration SQL
The complete migration SQL is in `COMPLETE_DATABASE_SETUP.sql`
- Size: ~38KB
- Contains: Full schema with 13 tables, indexes, RLS policies, triggers

### Step 3: Execute Migration
1. Copy the entire content of `COMPLETE_DATABASE_SETUP.sql`
2. Paste into the SQL Editor
3. Click "RUN" button
4. Wait for completion (usually 30-60 seconds)

### Step 4: Verify Migration Success
After running, check if these tables exist:
```sql
-- List all tables
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected tables:
- ✅ tenants
- ✅ users
- ✅ user_tenants
- ✅ projects
- ✅ units
- ✅ customers
- ✅ customer_interactions
- ✅ bookings
- ✅ payments
- ✅ campaigns
- ✅ campaign_responses
- ✅ notifications
- ✅ system_settings
- ✅ audit_logs

## 🎯 Post-Migration Setup

### Create Test Tenant with Owner
```sql
-- Create a tenant with owner user
SELECT create_tenant_with_owner(
    'Test Tenant',
    'mazmakerv2.sup@gmail.com',
    'Test Owner'
);
```

### Verify User Role
```sql
-- Check if user has owner role
SELECT
    u.email,
    ut.role,
    t.name as tenant_name
FROM users u
JOIN user_tenants ut ON u.id = ut.user_id
JOIN tenants t ON ut.tenant_id = t.id
WHERE u.email = 'mazmakerv2.sup@gmail.com';
```

## ⚠️ Important Notes

1. **Data Loss Warning**: This migration will drop existing tables and recreate them. Ensure you have backups if needed.

2. **RLS Policies**: Row Level Security is enabled on all tables. Users can only access data from their tenant.

3. **User Roles**: The system supports 4 roles:
   - `owner`: Full access to tenant settings
   - `admin`: Can manage most data
   - `sales`: Can manage customers and bookings
   - `viewer`: Read-only access

4. **Multi-Tenancy**: All data is isolated by tenant_id through RLS policies.

## 🔧 Troubleshooting

### If Migration Fails
1. Check Supabase logs for specific error messages
2. Ensure you're using the correct project (pqnjvcbmnatrtvpqnrdx)
3. Verify you have admin permissions

### Common Issues
- **Permission Denied**: Ensure you're logged in as admin
- **Already Exists**: Run `DROP TABLE IF EXISTS` statements first
- **Constraint Violations**: Check for existing data conflicts

## 📊 After Migration

### Test the Application
1. Run the app: `npm run dev`
2. Go to: http://localhost:5174
3. Login with: mazmakerv2.sup@gmail.com
4. Verify you can access the dashboard

### Check User Permissions
```javascript
// In browser console after login
supabase.from('user_tenants')
  .select('*, tenants(name)')
  .eq('user_id', userId)
  .eq('role', 'owner')
  .then(console.log);
```

## 🎉 Success Criteria

Migration is successful when:
- [x] All 13 tables are created
- [x] RLS policies are enabled
- [x] Indexes are created
- [x] Triggers are active
- [x] User can log in
- [x] User has owner role in a tenant
- [x] Dashboard loads without errors

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Review Supabase dashboard logs
3. Verify the SQL executed completely
4. Test with a fresh browser session