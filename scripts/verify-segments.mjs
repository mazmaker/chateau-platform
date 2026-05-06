import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.PGPASSWORD)}@db.pqnjvcbmnatrtvpqnrdx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const total = await c.query(`SELECT COUNT(*) FROM segment_members`);
console.log(`\nTotal segment_members rows: ${total.rows[0].count}`);

const summary = await c.query(`
  SELECT s.code, s.name, s.target_type, s.member_count,
         (SELECT COUNT(*) FROM segment_members sm WHERE sm.segment_id = s.id) AS actual_members
  FROM segments s ORDER BY s.member_count DESC
`);
console.table(summary.rows);

const sample = await c.query(`SELECT * FROM v_member_segments LIMIT 3`);
console.log('\nSample v_member_segments view:');
console.table(sample.rows);

await c.end();
