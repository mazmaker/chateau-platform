import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.PGPASSWORD)}@db.pqnjvcbmnatrtvpqnrdx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

// 1. List all public tables + row counts
const tablesQ = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_type='BASE TABLE'
  ORDER BY table_name
`);
const counts = [];
for (const row of tablesQ.rows) {
  const t = row.table_name;
  try {
    const r = await c.query(`SELECT COUNT(*) as n FROM ${t}`);
    counts.push({ table: t, rows: parseInt(r.rows[0].n) });
  } catch (e) {
    counts.push({ table: t, rows: 'err: ' + e.message });
  }
}

console.log('\n📦 Table row counts:');
console.table(counts);

// 2. Check key fields completeness on leads
console.log('\n📊 Leads field completeness (out of 10 rows):');
const leadFields = ['estimated_value', 'priority', 'last_contact_date', 'next_follow_up',
  'monthly_income', 'monthly_debt', 'down_payment_ready', 'household_size',
  'urgency_level', 'decision_maker', 'financing_approved', 'site_visit_attended',
  'potential_score', 'engagement_score', 'urgency_score', 'fit_score', 'conversion_probability'];
const leadStatsQ = await c.query(`SELECT
  COUNT(*) as total,
  ${leadFields.map(f => `COUNT(${f}) as ${f}_count`).join(',\n  ')}
  FROM leads`);
const ls = leadStatsQ.rows[0];
const leadCheck = leadFields.map(f => ({
  field: f,
  filled: parseInt(ls[`${f}_count`]),
  pct: Math.round(parseInt(ls[`${f}_count`]) / parseInt(ls.total) * 100) + '%',
}));
console.table(leadCheck);

// 3. Properties completeness
console.log('\n🏢 Properties field completeness (out of 33 rows):');
const propFields = ['name', 'type', 'base_price', 'images', 'description', 'address', 'tenant_id'];
const propStatsQ = await c.query(`SELECT
  COUNT(*) as total,
  ${propFields.map(f => `COUNT(${f}) as ${f}_count`).join(',\n  ')}
  FROM properties`);
const ps = propStatsQ.rows[0];
console.table(propFields.map(f => ({
  field: f,
  filled: parseInt(ps[`${f}_count`]),
  pct: Math.round(parseInt(ps[`${f}_count`]) / parseInt(ps.total) * 100) + '%',
})));

// 4. Customers
console.log('\n👤 Customers field completeness:');
const cusFields = ['full_name', 'email', 'phone', 'date_of_birth', 'preferences'];
const cusStatsQ = await c.query(`SELECT
  COUNT(*) as total,
  ${cusFields.map(f => `COUNT(${f}) as ${f}_count`).join(',\n  ')}
  FROM customers`);
const cs = cusStatsQ.rows[0];
console.table(cusFields.map(f => ({
  field: f,
  filled: parseInt(cs[`${f}_count`]),
  pct: Math.round(parseInt(cs[`${f}_count`]) / parseInt(cs.total) * 100) + '%',
})));

// 5. Distribution checks
console.log('\n📈 Lead status distribution:');
const statusQ = await c.query(`SELECT status, COUNT(*) as n FROM leads GROUP BY status`);
console.table(statusQ.rows);

console.log('\n📈 Lead priority distribution:');
const prioQ = await c.query(`SELECT priority, COUNT(*) as n FROM leads GROUP BY priority`);
console.table(prioQ.rows);

console.log('\n📈 Property type distribution:');
const typeQ = await c.query(`SELECT type, COUNT(*) as n FROM properties GROUP BY type`);
console.table(typeQ.rows);

await c.end();
