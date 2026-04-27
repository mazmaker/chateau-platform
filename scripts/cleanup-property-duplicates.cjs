/**
 * Cleanup duplicate properties/projects records.
 *
 * Strategy: For each duplicate name group:
 *   1. Find record with FK references → KEEP
 *   2. If multiple have refs → KEEP all (manual review needed, none in current data)
 *   3. If none have refs → KEEP oldest (created_at) — DELETE the rest
 *
 * Usage:
 *   node scripts/cleanup-property-duplicates.cjs           # dry-run (default)
 *   node scripts/cleanup-property-duplicates.cjs --execute # actual delete
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const EXECUTE = process.argv.includes('--execute');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function countFKRefs(id) {
  // Check tables that reference property/project IDs
  const [units, leadInterestsByProp, leadsByProp] = await Promise.all([
    sb.from('units').select('id', { count: 'exact', head: true }).eq('project_id', id),
    sb.from('lead_interests').select('id', { count: 'exact', head: true }).eq('property_id', id),
    sb.from('leads').select('id', { count: 'exact', head: true }).eq('property_id', id),
  ]);

  const unitIds = (await sb.from('units').select('id').eq('project_id', id)).data || [];
  const leadInterestsByUnit = unitIds.length > 0
    ? (await sb.from('lead_interests').select('id', { count: 'exact', head: true }).in('unit_id', unitIds.map(u => u.id))).count || 0
    : 0;

  return {
    units: units.count || 0,
    liByProp: leadInterestsByProp.count || 0,
    leadsByProp: leadsByProp.count || 0,
    liByUnit: leadInterestsByUnit,
    total: (units.count || 0) + (leadInterestsByProp.count || 0) + (leadsByProp.count || 0) + leadInterestsByUnit,
  };
}

async function findDuplicates(table) {
  const { data } = await sb.from(table).select('id, name, created_at').eq('tenant_id', TENANT_ID).order('name');
  const groups = {};
  for (const r of data || []) {
    if (!groups[r.name]) groups[r.name] = [];
    groups[r.name].push(r);
  }
  return Object.entries(groups).filter(([_, arr]) => arr.length > 1);
}

(async () => {
  console.log(`\n=== Property Duplicate Cleanup ${EXECUTE ? '(EXECUTE MODE)' : '(DRY RUN)'} ===\n`);

  // Get duplicate groups from properties table
  const propertiesDups = await findDuplicates('properties');
  console.log(`Found ${propertiesDups.length} duplicate name groups in properties table\n`);

  const idsToDelete = new Set();
  const idsToKeep = new Set();

  for (const [name, records] of propertiesDups) {
    // Check FK refs for each record
    const withRefs = [];
    for (const r of records) {
      r.refs = await countFKRefs(r.id);
      if (r.refs.total > 0) withRefs.push(r);
    }

    let keeper, deleting;
    if (withRefs.length === 1) {
      keeper = withRefs[0];
      deleting = records.filter(r => r.id !== keeper.id);
    } else if (withRefs.length === 0) {
      // Keep oldest, delete rest
      const sorted = [...records].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      keeper = sorted[0];
      deleting = sorted.slice(1);
    } else {
      // Multiple have refs — manual review needed
      console.log(`⚠️  ${name}: ${withRefs.length} records have FK refs — SKIPPING (manual review needed)`);
      continue;
    }

    idsToKeep.add(keeper.id);
    deleting.forEach(d => idsToDelete.add(d.id));

    const refSummary = keeper.refs.total > 0
      ? `units=${keeper.refs.units} leads=${keeper.refs.leadsByProp} li=${keeper.refs.liByProp + keeper.refs.liByUnit}`
      : 'no refs (oldest)';
    console.log(`✅ ${name}: KEEP ${keeper.id.substring(0, 8)} (${refSummary}), DELETE ${deleting.length} record(s)`);
  }

  console.log(`\n📊 Total records to delete: ${idsToDelete.size}`);
  console.log(`📊 Total records to keep:   ${idsToKeep.size}`);

  if (idsToDelete.size === 0) {
    console.log('\nNothing to delete. Exiting.');
    return;
  }

  if (!EXECUTE) {
    console.log('\n--- DRY RUN: No deletions performed ---');
    console.log('Run with --execute to actually delete (backup will be saved automatically).');
    return;
  }

  // ===== BACKUP STEP =====
  const idsArray = Array.from(idsToDelete);
  console.log('\n💾 Creating backup before deletion...');

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const [propsBackup, projectsBackup] = await Promise.all([
    sb.from('properties').select('*').in('id', idsArray),
    sb.from('projects').select('*').in('id', idsArray),
  ]);

  if (propsBackup.error) {
    console.error('   ❌ Backup error (properties):', propsBackup.error.message);
    return;
  }
  if (projectsBackup.error) {
    console.error('   ❌ Backup error (projects):', projectsBackup.error.message);
    return;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const backupPath = path.join(BACKUP_DIR, `property-duplicates-${ts}.json`);
  const backupData = {
    timestamp: new Date().toISOString(),
    tenant_id: TENANT_ID,
    deletion_strategy: 'duplicate cleanup — keep oldest or has FK refs',
    properties_deleted: propsBackup.data || [],
    projects_deleted: projectsBackup.data || [],
    ids_deleted: idsArray,
  };
  fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
  console.log(`   ✅ Backup saved: ${path.relative(process.cwd(), backupPath)}`);
  console.log(`   📦 properties records backed up: ${(propsBackup.data || []).length}`);
  console.log(`   📦 projects records backed up:   ${(projectsBackup.data || []).length}`);

  // ===== DELETION STEP =====
  console.log('\n🗑️  Deleting from properties table...');
  const { error: pErr, count: pCount } = await sb
    .from('properties')
    .delete({ count: 'exact' })
    .in('id', idsArray);
  if (pErr) {
    console.error('   ERROR:', pErr.message);
    console.error('   ⚠️  Backup is preserved at:', backupPath);
    return;
  }
  console.log(`   ✅ Deleted ${pCount} from properties`);

  console.log('🗑️  Deleting from projects table (same IDs)...');
  const { error: prErr, count: prCount } = await sb
    .from('projects')
    .delete({ count: 'exact' })
    .in('id', idsArray);
  if (prErr) {
    console.error('   ERROR:', prErr.message);
    console.error('   ⚠️  Properties already deleted but projects failed. Backup at:', backupPath);
    return;
  }
  console.log(`   ✅ Deleted ${prCount} from projects`);

  // Final counts
  const { count: pAfter } = await sb.from('properties').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
  const { count: prAfter } = await sb.from('projects').select('*', { count: 'exact', head: true }).eq('tenant_id', TENANT_ID);
  console.log(`\n📊 Final counts: properties=${pAfter}, projects=${prAfter}`);
})();
