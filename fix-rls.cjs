#!/usr/bin/env node
/**
 * Fix RLS Infinite Recursion
 */

const https = require('https');

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

const fixSQL = `
-- Fix RLS infinite recursion on users table
DROP POLICY IF EXISTS "Users can view users in same tenant" ON users;
DROP POLICY IF EXISTS "Users can update users in same tenant" ON users;
DROP POLICY IF EXISTS "Service role can manage all users" ON users;

CREATE POLICY "Users can view own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own record" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Service role bypass" ON users
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
`;

function execRPC(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });

    const req = https.request({
      hostname: 'pqnjvcbmnatrtvpqnrdx.supabase.co',
      path: '/rest/v1/rpc/exec_sql',
      method: 'POST',
      headers: {
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body);
        }
      });
    });

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('\n=== Fixing RLS Policies ===\n');

  // Try using pgadmin approach via direct REST
  const result = await execRPC(fixSQL);

  console.log('Result:', result);
  console.log('\n✅ Done! Please refresh the page.\n');
}

main();
