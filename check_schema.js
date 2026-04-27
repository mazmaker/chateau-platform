const { createClient } = require('@supabase/supabase-js');

const url = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODM2NTEsImV4cCI6MjA4MTU1OTY1MX0.8YSVEdOvlJHkupqMJXy3HUtV-7L-OtcRTjd9rYVPFk0';

async function checkSchema() {
  const supabase = createClient(url, key);
  
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║         CHATEAU PLATFORM - DATABASE SCHEMA                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  const tableList = ['tenants', 'users', 'properties', 'customers', 'bookings'];
  
  for (const table of tableList) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      const status = error ? '❌' : '✅';
      const countStr = error ? 'Error' : count + ' records';
      console.log(status + ' ' + table.padEnd(15) + ' - ' + countStr);
    } catch (e) {
      console.log('❌ ' + table.padEnd(15) + ' - Error');
    }
  }
  
  console.log('\n📍 URL: https://pqnjvcbmnatrtvpqnrdx.supabase.co');
  console.log('🌍 Region: South Asia (Mumbai)\n');
}

checkSchema();
