#!/usr/bin/env node
/**
 * Run RLS Fix SQL using psql command
 */

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Database connection string from Supabase
// Format: postgresql://postgres:[password]@[host]:5432/postgres
const DB_URL = 'postgresql://postgres.pqnjvcbmnatrtvpqnrdx:AVeryStr0ngP@ssw0rd!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const sqlFile = path.join(__dirname, 'fix-rls-complete.sql');

console.log('\n=== Running RLS Fix SQL via psql ===\n');

const psql = exec(
  `psql "${DB_URL}" -f "${sqlFile}"`,
  { encoding: 'utf8' }
);

psql.stdout.on('data', (data) => {
  process.stdout.write(data);
});

psql.stderr.on('data', (data) => {
  process.stderr.write('STDERR: ' + data);
});

psql.on('close', (code) => {
  console.log(`\npsql process exited with code ${code}`);

  if (code === 0) {
    console.log('\n✅ RLS Fix completed successfully!\n');
    console.log('Next steps:');
    console.log('1. Refresh your browser');
    console.log('2. Try logging in with mazmakerv2.sup@gmail.com');
    console.log('3. Check that you see "Owner" role in the dashboard\n');
  } else {
    console.log('\n⚠️  If psql is not installed, please run the SQL manually:');
    console.log('https://supabase.com/dashboard/project/pqnjvcbmnatrtvpqnrdx/sql\n');
    console.log('Copy the content from: fix-rls-complete.sql\n');
  }
});
