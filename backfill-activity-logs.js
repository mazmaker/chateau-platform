// Script to backfill activity logs for existing tenants
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function backfillActivityLogs() {
  try {
    console.log('🔄 Fetching existing tenants...\n');

    // Fetch all tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('*')
      .order('created_at', { ascending: false });

    if (tenantsError) {
      console.error('Error fetching tenants:', tenantsError);
      return;
    }

    console.log(`Found ${tenants.length} tenants\n`);

    // Get owner user
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();

    if (userError) {
      console.error('Error fetching users:', userError);
      return;
    }

    // Find the first owner/admin user
    const ownerUser = users.find(u => u.email && (u.email.includes('admin') || u.email.includes('owner')));

    if (!ownerUser && users.length === 0) {
      console.log('⚠️ No users found, using null for user_id');
    }

    const userId = ownerUser?.id || null;

    console.log('=== Backfilling Activity Logs ===\n');

    let successCount = 0;
    let errorCount = 0;

    for (const tenant of tenants) {
      try {
        // Calculate days ago for realistic timestamp
        const createdAt = new Date(tenant.created_at);
        const daysAgo = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

        // Determine activity description based on status
        let description = `สร้างบริษัทใหม่: ${tenant.name}`;
        if (tenant.status === 'suspended') {
          description = `สร้างบริษัทใหม่: ${tenant.name} (ถูกระงับ)`;
        }

        // Insert activity log using direct insert instead of RPC
        const { data: activityData, error: activityError } = await supabase
          .from('activity_logs')
          .insert({
            tenant_id: tenant.id,
            user_id: userId,
            activity_type: 'tenant_created',
            description: description,
            metadata: {
              tenant_id: tenant.id,
              name: tenant.name,
              plan: tenant.subscription_plan,
              status: tenant.status,
              backfilled: true
            },
            created_at: tenant.created_at  // Use original tenant created_at
          })
          .select();

        if (activityError) {
          console.error(`  ❌ Error for ${tenant.name}:`, activityError.message);
          errorCount++;
        } else {
          console.log(`  ✅ Created activity for: ${tenant.name} (${tenant.subscription_plan})`);
          successCount++;
        }

      } catch (err) {
        console.error(`  ❌ Error processing ${tenant.name}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n=== Summary ===');
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total: ${tenants.length}`);

    if (successCount > 0) {
      console.log('\n✅ Activity logs backfilled successfully!');
      console.log('🔄 Please refresh Owner Dashboard to see activities.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

backfillActivityLogs();
