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
  'supabase/migrations/20260424000005_fix_segment_evaluation.sql',
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

console.log('\nRefreshing all segments...');
const r = await client.query('SELECT segment_id, segment_name, member_count FROM refresh_all_segments()');
console.table(r.rows);

console.log('\nDone.');
await client.end();
