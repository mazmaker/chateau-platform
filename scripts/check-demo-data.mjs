import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.PGPASSWORD)}@db.pqnjvcbmnatrtvpqnrdx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const tables = ['campaigns', 'leads', 'customers', 'properties', 'segments', 'segment_members', 'triggers'];
const results = [];
for (const t of tables) {
  const r = await c.query(`SELECT COUNT(*) FROM ${t}`);
  results.push({ table: t, rows: r.rows[0].count });
}
console.table(results);

console.log('\nCampaigns sample:');
const cmp = await c.query(`SELECT campaign_name, status, recipients_count, impressions_count, clicks_count, ctr FROM campaigns ORDER BY recipients_count DESC LIMIT 5`);
console.table(cmp.rows);

console.log('\nKey metrics that Marketing Analytics SHOULD use:');
const totals = await c.query(`
  SELECT
    COUNT(*) as total_campaigns,
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COALESCE(SUM(recipients_count), 0) as total_sent,
    COALESCE(SUM(impressions_count), 0) as total_opened,
    COALESCE(SUM(clicks_count), 0) as total_clicked,
    ROUND(AVG(ctr)::numeric, 1) as avg_ctr
  FROM campaigns
`);
console.table(totals.rows);

await c.end();
