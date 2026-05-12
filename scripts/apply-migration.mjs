import { readFile } from 'node:fs/promises';
import pg from 'pg';

const { Client } = pg;

const PROJECT_REF = 'pqnjvcbmnatrtvpqnrdx';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD;
const MIGRATION_FILE = process.argv[2];

if (!PASSWORD) {
  console.error('Missing SUPABASE_DB_PASSWORD env var');
  process.exit(1);
}
if (!MIGRATION_FILE) {
  console.error('Usage: node apply-migration.mjs <migration-file.sql>');
  process.exit(1);
}

const connectionString = `postgres://postgres:${PASSWORD}@db.${PROJECT_REF}.supabase.co:5432/postgres`;

const sql = await readFile(MIGRATION_FILE, 'utf8');
console.log(`Applying migration: ${MIGRATION_FILE}`);
console.log(`SQL bytes: ${sql.length}`);

const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
try {
  await client.connect();
  console.log('Connected to Supabase Postgres');

  await client.query('BEGIN');
  await client.query(sql);
  await client.query('COMMIT');
  console.log('Migration applied successfully (committed)');
} catch (err) {
  try { await client.query('ROLLBACK'); } catch {}
  console.error('Migration failed — rolled back:');
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
