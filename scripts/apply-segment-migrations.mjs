import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const { Client } = pg;

const PROJECT_REF = 'pqnjvcbmnatrtvpqnrdx';
const PASSWORD = process.env.PGPASSWORD;
if (!PASSWORD) {
  console.error('Set PGPASSWORD env var first.');
  process.exit(1);
}

const FILES = [
  'supabase/migrations/20260424000007_demo_data_polish.sql',
];

const connectionString = `postgresql://postgres:${encodeURIComponent(PASSWORD)}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
console.log('Connected to remote Postgres.');

for (const f of FILES) {
  const sql = readFileSync(resolve(f), 'utf8');
  console.log(`\nApplying ${f}  (${sql.length} bytes)...`);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`  ✓ ${f}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`  ✗ FAILED: ${err.message}`);
    process.exit(1);
  }
}

console.log('\nVerifying lead aggregates after polish...');
const r = await client.query(`
  SELECT
    COUNT(*) as total_leads,
    COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', NOW())) as leads_mtd,
    COUNT(*) FILTER (WHERE priority = 'high') as hot_leads,
    COUNT(*) FILTER (WHERE last_contact_date < NOW() - INTERVAL '30 days') as inactive_leads,
    SUM(estimated_value)::bigint as pipeline_value,
    COUNT(DISTINCT status) as status_variety
  FROM leads
`);
console.table(r.rows);

const statusDist = await client.query("SELECT status, COUNT(*) as n FROM leads GROUP BY status ORDER BY n DESC");
console.log('Status distribution:');
console.table(statusDist.rows);

console.log('\nDone.');
await client.end();
