// Script to check what columns exist in tenants table
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkColumns() {
  try {
    // Try to fetch a tenant with all possible fields to see what actually exists
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .limit(1);

    if (error) {
      console.log('Error:', error.message);
      return;
    }

    if (data && data.length > 0) {
      console.log('=== Columns that exist in tenants table ===');
      const columns = Object.keys(data[0]);
      columns.forEach(col => console.log(`  - ${col}`));

      console.log('\n=== Checking for missing columns ===');
      const expectedColumns = [
        'id', 'name', 'slug', 'status', 'subscription_plan',
        'max_properties', 'max_users', 'trial_ends_at',
        'billing_address', 'billing_email', 'billing_phone', 'tax_id'
      ];

      expectedColumns.forEach(col => {
        const exists = columns.includes(col);
        console.log(`  ${exists ? '✅' : '❌'} ${col}`);
      });
    } else {
      console.log('No tenants found in database');
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkColumns();
