// Try to create a temporary RPC function to execute SQL
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function tryDirectSQL() {
  console.log('🔄 Attempting to add columns...\n');

  // First, let's check if we can use the postgres extension
  const SQL = `
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'max_users') THEN
    ALTER TABLE tenants ADD COLUMN max_users integer DEFAULT 5;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'trial_ends_at') THEN
    ALTER TABLE tenants ADD COLUMN trial_ends_at timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'billing_address') THEN
    ALTER TABLE tenants ADD COLUMN billing_address text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'billing_email') THEN
    ALTER TABLE tenants ADD COLUMN billing_email text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'billing_phone') THEN
    ALTER TABLE tenants ADD COLUMN billing_phone text;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tenants' AND column_name = 'tax_id') THEN
    ALTER TABLE tenants ADD COLUMN tax_id text;
  END IF;
END $$;
`;

  // Try using Supabase v2 SQL API
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Prefer': 'params=single-object'
      },
      body: JSON.stringify({
        query: SQL
      })
    });

    const text = await response.text();
    console.log('Response:', text);

    if (response.ok) {
      console.log('✅ Success!');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }

  // Final instruction
  console.log('\n⚠️ Automatic execution is not supported by Supabase REST API.');
  console.log('This is a security feature to prevent SQL injection.\n');

  console.log('📋 PLEASE COPY AND RUN THIS SQL IN YOUR SUPABASE DASHBOARD:');
  console.log('==============================================================\n');
  console.log(SQL);
  console.log('\n==============================================================');
  console.log('\n🔗 Go to: https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql\n');
  console.log('Steps:');
  console.log('1. Open the link above');
  console.log('2. Paste the SQL code');
  console.log('3. Click "Run" button');
  console.log('4. After that, the edit form will work!\n');
}

tryDirectSQL();
