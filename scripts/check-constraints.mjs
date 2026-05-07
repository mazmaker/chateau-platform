import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.PGPASSWORD)}@db.pqnjvcbmnatrtvpqnrdx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

console.log('Check constraints on leads:');
const r = await c.query(`
  SELECT conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'public.leads'::regclass AND contype = 'c'
  ORDER BY conname
`);
console.table(r.rows);

console.log('\nDistinct values currently in DB:');
const fields = ['status', 'priority', 'source', 'urgency_level', 'employment_type', 'gender', 'marital_status', 'education'];
for (const f of fields) {
  try {
    const v = await c.query(`SELECT DISTINCT ${f} FROM leads WHERE ${f} IS NOT NULL`);
    console.log(`${f}:`, v.rows.map(r => r[f]).join(', '));
  } catch {}
}

await c.end();
