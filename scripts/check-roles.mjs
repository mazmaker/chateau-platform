import pg from 'pg';
const { Client } = pg;
const c = new Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(process.env.PGPASSWORD)}@db.pqnjvcbmnatrtvpqnrdx.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await c.connect();

console.log('\n=== Roles ใน users table ===');
const usersRoles = await c.query(`SELECT role, COUNT(*) AS count FROM users GROUP BY role`);
console.table(usersRoles.rows);


console.log('\n=== CHECK constraints บน role columns ===');
const constraints = await c.query(`
  SELECT conrelid::regclass AS "table", conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE contype='c' AND pg_get_constraintdef(oid) ILIKE '%role%'
  ORDER BY "table"
`);
console.table(constraints.rows);

console.log('\n=== Users + role + email ===');
const usersList = await c.query(`SELECT email, role, full_name, is_active FROM users ORDER BY role, email`);
console.table(usersList.rows);

console.log('\n=== Profiles count by role ===');
const profilesRoles = await c.query(`
  SELECT role, COUNT(*) FROM profiles WHERE role IS NOT NULL GROUP BY role
`);
console.table(profilesRoles.rows);

await c.end();
