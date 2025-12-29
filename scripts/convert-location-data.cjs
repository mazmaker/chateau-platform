const fs = require('fs');
const path = require('path');

const locationDir = 'C:/chitpon59/dev/project/Chatuae/Location';
const outputDir = 'C:/chitpon59/dev/project/Chatuae/chateau-platform2/chateau-platform/supabase/migrations';

// Read and parse district data
function parseDistricts() {
  const content = fs.readFileSync(path.join(locationDir, '003_district.sql'), 'utf8');
  const lines = content.split('\n');
  const inserts = [];

  for (const line of lines) {
    const match = line.match(/^\((\d+),\s*'(\d+)',\s*'([^']+)',\s*'([^']+)',\s*\d+,\s*(\d+)\)/);
    if (match) {
      const [, id, code, name_th, name_en, province_id] = match;
      inserts.push(`(${id}, '${code}', '${name_th.trim()}', '${name_en.trim()}', ${province_id})`);
    }
  }

  return inserts;
}

// Read and parse sub-district data
function parseSubDistricts() {
  const content = fs.readFileSync(path.join(locationDir, '004_sub_district.sql'), 'utf8');
  const lines = content.split('\n');
  const inserts = [];

  for (const line of lines) {
    const match = line.match(/^\((\d+),\s*'(\d+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+),\s*\d+\)/);
    if (match) {
      const [, id, code, name_th, name_en, district_id, province_id] = match;
      inserts.push(`(${id}, '${code}', '${name_th.trim()}', '${name_en.trim()}', ${district_id}, ${province_id})`);
    }
  }

  return inserts;
}

// Read and parse zipcode data
function parseZipcodes() {
  const content = fs.readFileSync(path.join(locationDir, '005_zipcode.sql'), 'utf8');
  const lines = content.split('\n');
  const inserts = [];

  for (const line of lines) {
    const match = line.match(/^\((\d+),\s*'(\d+)',\s*'(\d+)'\)/);
    if (match) {
      const [, id, district_code, zipcode] = match;
      inserts.push(`(${id}, '${district_code}', '${zipcode}')`);
    }
  }

  return inserts;
}

// Generate migration file for districts
function generateDistrictMigration() {
  const districts = parseDistricts();
  console.log(`Found ${districts.length} districts`);

  // Split into batches of 100 for better performance
  const batches = [];
  for (let i = 0; i < districts.length; i += 100) {
    batches.push(districts.slice(i, i + 100));
  }

  let sql = '-- Thailand Districts (Amphoe) Data\n\n';

  for (const batch of batches) {
    sql += 'INSERT INTO th_districts (id, code, name_th, name_en, province_id) VALUES\n';
    sql += batch.join(',\n') + ';\n\n';
  }

  sql += `-- Reset sequence\nSELECT setval('th_districts_id_seq', ${districts.length});\n`;

  fs.writeFileSync(path.join(outputDir, '20251228000001_thailand_districts.sql'), sql);
  console.log('Districts migration created');
}

// Generate migration file for sub-districts
function generateSubDistrictMigration() {
  const subDistricts = parseSubDistricts();
  console.log(`Found ${subDistricts.length} sub-districts`);

  // Split into batches of 100 for better performance
  const batches = [];
  for (let i = 0; i < subDistricts.length; i += 100) {
    batches.push(subDistricts.slice(i, i + 100));
  }

  let sql = '-- Thailand Sub-Districts (Tambon) Data\n\n';

  for (const batch of batches) {
    sql += 'INSERT INTO th_sub_districts (id, code, name_th, name_en, district_id, province_id) VALUES\n';
    sql += batch.join(',\n') + ';\n\n';
  }

  sql += `-- Reset sequence\nSELECT setval('th_sub_districts_id_seq', ${subDistricts.length});\n`;

  fs.writeFileSync(path.join(outputDir, '20251228000002_thailand_sub_districts.sql'), sql);
  console.log('Sub-districts migration created');
}

// Generate migration file for zipcodes
function generateZipcodeMigration() {
  const zipcodes = parseZipcodes();
  console.log(`Found ${zipcodes.length} zipcodes`);

  // Split into batches of 100 for better performance
  const batches = [];
  for (let i = 0; i < zipcodes.length; i += 100) {
    batches.push(zipcodes.slice(i, i + 100));
  }

  let sql = '-- Thailand Zipcodes Data\n\n';

  for (const batch of batches) {
    sql += 'INSERT INTO th_zipcodes (id, sub_district_code, zipcode) VALUES\n';
    sql += batch.join(',\n') + ';\n\n';
  }

  sql += `-- Reset sequence\nSELECT setval('th_zipcodes_id_seq', ${zipcodes.length});\n`;

  fs.writeFileSync(path.join(outputDir, '20251228000003_thailand_zipcodes.sql'), sql);
  console.log('Zipcodes migration created');
}

// Run all conversions
generateDistrictMigration();
generateSubDistrictMigration();
generateZipcodeMigration();

console.log('All migrations created successfully!');
