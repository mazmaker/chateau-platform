// Check activity logs in database
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkActivityLogs() {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log('=== Recent Activity Logs ===\n');
    data.forEach((log, index) => {
      console.log(`${index + 1}. [${log.activity_type}] ${log.description}`);
      console.log(`   Tenant ID: ${log.tenant_id}`);
      console.log(`   User ID: ${log.user_id}`);
      console.log(`   Created: ${log.created_at}`);
      console.log('');
    });

    console.log(`Total: ${data.length} logs`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkActivityLogs();
