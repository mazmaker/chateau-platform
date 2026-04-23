// Sync properties to projects table
import https from 'https';

const supabaseUrl = 'pqnjvcbmnatrtvpqnrdx.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxbmp2Y2JtbmF0cnR2cHFucmR4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTk4MzY1MSwiZXhwIjoyMDgxNTU5NjUxfQ.1clCRvzg5KgPgqFmmtQXc9JjOjQnlvrcANsJb8YbKb4';

function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: supabaseUrl,
      port: 443,
      path: '/rest/v1' + path,
      method: method,
      headers: {
        'apikey': serviceKey,
        'Authorization': 'Bearer ' + serviceKey,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };

    const req = https.request(options, (res) => {
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
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function syncPropertiesToProjects() {
  console.log('Fetching properties...');
  const properties = await makeRequest('GET', '/properties?select=id,tenant_id,name,address');
  console.log('Found', properties.length, 'properties');

  console.log('Fetching existing projects...');
  const projects = await makeRequest('GET', '/projects?select=id');
  const existingIds = new Set(projects.map(p => p.id));
  console.log('Found', existingIds.size, 'existing projects');

  const toSync = properties.filter(p => !existingIds.has(p.id));
  console.log('Need to sync', toSync.length, 'properties to projects');

  for (const prop of toSync) {
    console.log('Syncing:', prop.name);
    const result = await makeRequest('POST', '/projects', {
      id: prop.id,
      tenant_id: prop.tenant_id,
      name: prop.name,
      address: prop.address || { street: '', province: '', district: '', sub_district: '', postal_code: '', country: 'Thailand' }
    });
    if (result.code) {
      console.log('  Error:', result.message);
    } else {
      console.log('  OK');
    }
  }

  console.log('Done!');
}

syncPropertiesToProjects().catch(console.error);
