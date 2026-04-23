// Seed sample data for CHATEAU Platform dashboard testing
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  console.log('Available vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
  process.exit(1);
}

// Create client with anon key (for testing - would need service key for production)
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function seedSampleData() {
  try {
    console.log('🌱 Starting data seeding...');

    // 1. Get or create a test tenant
    let { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', 'chateau-test')
      .single();

    if (tenantError || !tenant) {
      console.log('📄 Creating test tenant...');
      const { data: newTenant, error: createTenantError } = await supabase
        .from('tenants')
        .insert({
          name: 'CHATEAU Test Company',
          slug: 'chateau-test',
          subscription_plan: 'professional',
          status: 'active'
        })
        .select('id')
        .single();

      if (createTenantError) {
        console.error('❌ Error creating tenant:', createTenantError);
        return;
      }
      tenant = newTenant;
    }

    console.log('✅ Tenant ID:', tenant.id);

    // 2. Create sample projects/properties
    console.log('🏘️ Creating sample properties...');

    const properties = [
      {
        tenant_id: tenant.id,
        name: 'THE FORESTIAS',
        type: 'condo',
        description: 'โครงการคอนโดหรูใจกลางธรรมชาติ',
        address: { street: 'ถนนบางนา-ตราด', district: 'บางพลี', province: 'สมุทรปราการ' },
        base_price: 15000000,
        currency: 'THB',
        max_guests: 4,
        bedrooms: 2,
        bathrooms: 2,
        size_sqft: 85,
        is_active: true
      },
      {
        tenant_id: tenant.id,
        name: 'ONE BANGKOK',
        type: 'condo',
        description: 'โครงการมิกซ์ยูสระดับโลก',
        address: { street: 'ถนนวิทยุ', district: 'ปทุมวัน', province: 'กรุงเทพฯ' },
        base_price: 45000000,
        currency: 'THB',
        max_guests: 4,
        bedrooms: 3,
        bathrooms: 3,
        size_sqft: 150,
        is_active: true
      },
      {
        tenant_id: tenant.id,
        name: 'WHIZDOM 101',
        type: 'condo',
        description: 'คอนโดติด BTS',
        address: { street: 'ซอยสุขุมวิท 101', district: 'พระโขนง', province: 'กรุงเทพฯ' },
        base_price: 3500000,
        currency: 'THB',
        max_guests: 2,
        bedrooms: 1,
        bathrooms: 1,
        size_sqft: 28,
        is_active: true
      }
    ];

    const { data: insertedProperties, error: propertiesError } = await supabase
      .from('properties')
      .insert(properties)
      .select('id, name');

    if (propertiesError) {
      console.error('❌ Error creating properties:', propertiesError);
      return;
    }

    console.log('✅ Created properties:', insertedProperties.map(p => p.name));

    // 3. Create sample units
    console.log('🏠 Creating sample units...');

    const units = [];
    const statuses = ['available', 'reserved', 'sold', 'unavailable'];

    insertedProperties.forEach((property, propIndex) => {
      const unitsPerProperty = propIndex === 0 ? 100 : propIndex === 1 ? 80 : 50;

      for (let i = 1; i <= unitsPerProperty; i++) {
        const floor = Math.ceil(i / 10);
        const unitNum = i % 10 || 10;
        const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

        units.push({
          tenant_id: tenant.id,
          property_id: property.id,
          unit_number: `${floor}${unitNum.toString().padStart(2, '0')}`,
          floor: floor,
          price: property.base_price + (Math.random() * 1000000),
          size_sqm: 25 + (Math.random() * 50),
          bedrooms: propIndex + 1,
          bathrooms: propIndex + 1,
          status: randomStatus
        });
      }
    });

    const { error: unitsError } = await supabase
      .from('units')
      .insert(units);

    if (unitsError) {
      console.error('❌ Error creating units:', unitsError);
      return;
    }

    console.log('✅ Created units:', units.length);

    // 4. Create sample leads
    console.log('📞 Creating sample leads...');

    const leadStatuses = ['new', 'contacted', 'qualified', 'negotiating', 'won', 'lost'];
    const leads = [];

    for (let i = 1; i <= 50; i++) {
      const randomProperty = insertedProperties[Math.floor(Math.random() * insertedProperties.length)];
      const randomStatus = leadStatuses[Math.floor(Math.random() * leadStatuses.length)];
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - Math.floor(Math.random() * 90)); // Last 90 days

      leads.push({
        tenant_id: tenant.id,
        property_id: randomProperty.id,
        status: randomStatus,
        source: ['online', 'offline', 'referral'][Math.floor(Math.random() * 3)],
        estimated_value: 1000000 + (Math.random() * 10000000),
        created_at: createdDate.toISOString()
      });
    }

    const { error: leadsError } = await supabase
      .from('leads')
      .insert(leads);

    if (leadsError) {
      console.error('❌ Error creating leads:', leadsError);
      return;
    }

    console.log('✅ Created leads:', leads.length);

    // 5. Summary
    console.log('\n🎉 Sample data seeding completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Properties: ${insertedProperties.length}`);
    console.log(`   - Units: ${units.length}`);
    console.log(`   - Leads: ${leads.length}`);
    console.log(`   - Tenant ID: ${tenant.id}`);

    console.log('\n✨ You can now test the dashboard with real data!');

  } catch (error) {
    console.error('🚨 Seeding failed:', error);
  }
}

// Run if called directly
if (process.argv[1].endsWith('seed-sample-data.js')) {
  seedSampleData().then(() => process.exit(0));
}

export default seedSampleData;