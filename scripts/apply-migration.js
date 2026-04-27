/**
 * Script to apply database migration directly via Supabase REST API
 * Usage: node scripts/apply-migration.js <migration-file-path>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration from .env.local
const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Read migration file
const migrationPath = process.argv[2];
if (!migrationPath) {
  console.error('Usage: node scripts/apply-migration.js <migration-file-path>');
  process.exit(1);
}

let sql;
try {
  sql = readFileSync(migrationPath, 'utf8');
} catch (err) {
  console.error('Error reading migration file:', err.message);
  process.exit(1);
}

// Create Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function applyMigration() {
  console.log(`Applying migration: ${migrationPath}`);
  console.log('--- SQL ---');
  console.log(sql);
  console.log('--- END SQL ---');

  // Execute SQL via RPC
  // Note: This requires the exec_sql function to exist in the database
  const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  }

  console.log('Migration applied successfully!');
  console.log('Result:', data);
}

applyMigration().catch(console.error);
