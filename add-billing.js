// Add billing columns using node-postgres
import postgres from 'postgres';

const connectionString = 'postgres://postgres.pqnjvcbmnatrtvpqnrdx:WJyIVdg39zCK8tYV@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres';

const sql = postgres(connectionString, {
  ssl: 'require',
});

async function addBillingColumns() {
  try {
    console.log('🔄 Connecting to database...\n');

    // Check current columns
    const columns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      ORDER BY ordinal_position
    `;

    console.log('=== Current columns ===');
    columns.forEach(c => console.log(`  - ${c.column_name}`));

    const columnNames = columns.map(c => c.column_name);

    // Add billing columns
    const billingColumns = [
      'billing_address',
      'billing_email',
      'billing_phone',
      'tax_id'
    ];

    console.log('\n=== Adding billing columns ===\n');

    for (const col of billingColumns) {
      if (!columnNames.includes(col)) {
        console.log(`Adding ${col}...`);
        await sql.unsafe(`ALTER TABLE tenants ADD COLUMN ${col} text`);
        console.log(`  ✅ Added ${col}`);
      } else {
        console.log(`  ✓ ${col} already exists`);
      }
    }

    // Verify
    console.log('\n=== Verification ===');
    const finalColumns = await sql`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tenants'
      AND column_name IN ('billing_address', 'billing_email', 'billing_phone', 'tax_id')
    `;

    console.log('Billing columns after migration:');
    finalColumns.forEach(col => console.log(`  ✅ ${col.column_name}`));

    console.log('\n✅ Successfully completed!');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sql.end();
  }
}

addBillingColumns();
