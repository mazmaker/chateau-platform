#!/usr/bin/env node
/**
 * Check All User Roles
 * Run: node check-roles.cjs
 */

const https = require('https');

const SUPABASE_URL = 'https://pqnjvcbmnatrtvpqnrdx.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      port: 443
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve(data); }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function check() {
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║          CHATEAU Platform - User Roles Report         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');

  const users = await fetch(`${SUPABASE_URL}/rest/v1/users?select=*&order=email`, {
    headers: { 'apikey': SERVICE_ROLE_KEY, 'Authorization': `Bearer ${SERVICE_ROLE_KEY}` }
  });

  console.log('┌────┬─────────────────────────────┬─────────┬────────┬────────┐');
  console.log('│ No │ Email                      │ Role    │ Active │ Icon   │');
  console.log('├────┼─────────────────────────────┼─────────┼────────┼────────┤');

  users.forEach((u, i) => {
    const icon = u.role === 'owner' ? '👑' : u.role === 'admin' ? '🔧' : '💼';
    const email = (u.email || '').substring(0, 27).padEnd(27);
    const role = (u.role || '').toUpperCase().padEnd(7);
    const active = u.is_active ? '✅ Yes' : '❌ No ';
    console.log(`│ ${String(i+1).padStart(2)} │ ${email} │ ${role} │ ${active} │   ${icon}   │`);
  });

  console.log('└────┴─────────────────────────────┴─────────┴────────┴────────┘');
  console.log(`\nTotal Users: ${users.length}`);
  console.log('Tenant ID: 00000000-0000-0000-0000-000000000001\n');
}

check();
