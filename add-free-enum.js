// Add 'free' value to subscription_plan enum using Supabase REST API
// Since direct SQL execution is not available via REST, this shows the SQL to run manually

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  Add "free" to subscription_plan enum                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

console.log('⚠️ Direct SQL execution via REST API is not supported by Supabase.\n');

console.log('📋 Please run this SQL in Supabase Dashboard:\n');
console.log('═══════════════════════════════════════════════════════════════\n');
console.log('-- Check if "free" already exists');
console.log('SELECT enumlabel FROM pg_enum');
console.log('WHERE enumtypid = \'subscription_plan\'::regtype');
console.log('ORDER BY enumsortorder;\n');
console.log('-- Add "free" value (run only if not exists)');
console.log('ALTER TYPE subscription_plan ADD VALUE \'free\';');
console.log('\n═══════════════════════════════════════════════════════════════\n');
console.log('🔗 Go to: https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql\n');
console.log('Steps:');
console.log('1. Open the link above');
console.log('2. Paste the SQL code');
console.log('3. Click "Run" button');
console.log('4. After that, you can create/edit tenants with Free plan\n');

// For automation with psql if available
console.log('💡 Or run with psql if installed:');
console.log('   PGPASSWORD="WJyIVdg39zCK8tYV" psql -h aws-0-ap-southeast-1.pooler.supabase.com \\');
console.log('   -p 5432 -U postgres.pqnjvcbmnatrtvpqnrdx -d postgres \\');
console.log('   -c "ALTER TYPE subscription_plan ADD VALUE \'free\';"\n');
