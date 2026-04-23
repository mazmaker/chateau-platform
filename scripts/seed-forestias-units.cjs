/**
 * Seed script to create 20 sample units for THE FORESTIAS project
 */
require('dotenv').config({ path: '.env.local' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const PROPERTY_ID = '196b6c37-4787-4513-b762-46638813c0a6';
const TENANT_ID = '00000000-0000-0000-0000-000000000001';

async function createProjectAndUnits() {
  // Step 1: Create project entry for THE FORESTIAS
  console.log('📦 Creating project entry for THE FORESTIAS...');

  let response = await fetch(SUPABASE_URL + '/rest/v1/projects', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      id: PROPERTY_ID,
      tenant_id: TENANT_ID,
      name: 'THE FORESTIAS',
      description: 'THE FORESTIAS by MQDC - ที่สุดแห่งการอยู่อาศัยที่ผสานธรรมชาติกับชีวิตเมือง',
      address: {
        street: 'ถนนบางนา-ตราด กม.7',
        sub_district: 'บางแก้ว',
        district: 'บางพลี',
        province: 'สมุทรปราการ',
        postal_code: '10540'
      },
      is_active: true,
      total_units: 20,
      price_min: 3500000,
      price_max: 22000000,
      developer: 'MQDC'
    })
  });

  let result = await response.text();
  if (response.ok) {
    console.log('✅ Project created!');
  } else {
    console.log('⚠️ Project:', response.status, result.substring(0, 200));
  }

  // Step 2: Delete existing units for this project
  console.log('\n🧹 Clearing existing units...');
  await fetch(SUPABASE_URL + '/rest/v1/units?project_id=eq.' + PROPERTY_ID, {
    method: 'DELETE',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY
    }
  });

  // Step 3: Create 20 units
  console.log('\n🔧 Creating 20 sample units...');

  const sampleUnits = [
    { unit_number: 'A-1001', floor_number: 10, price: 3500000, area_sqm: 32, bedrooms: 0, bathrooms: 1, unit_type: 'Studio', building: 'A', facing_direction: 'N', status: 'available', layout_description: 'ห้อง Studio วิวสวน ทิศเหนือ เย็นสบาย' },
    { unit_number: 'A-1002', floor_number: 10, price: 4200000, area_sqm: 38, bedrooms: 1, bathrooms: 1, unit_type: '1 Bedroom', building: 'A', facing_direction: 'E', status: 'available', layout_description: 'ห้อง 1 นอน วิวสวนป่า ห้องมุม' },
    { unit_number: 'A-1501', floor_number: 15, price: 4800000, area_sqm: 42, bedrooms: 1, bathrooms: 1, unit_type: '1 Bedroom', building: 'A', facing_direction: 'N', status: 'reserved', layout_description: 'ห้อง 1 นอน ชั้นสูง วิวเมือง' },
    { unit_number: 'A-1502', floor_number: 15, price: 5200000, area_sqm: 45, bedrooms: 1, bathrooms: 1, unit_type: '1 Bedroom', building: 'A', facing_direction: 'NE', status: 'sold', layout_description: 'ห้อง 1 นอน ห้องมุม วิว 180 องศา' },
    { unit_number: 'A-2001', floor_number: 20, price: 5800000, area_sqm: 48, bedrooms: 1, bathrooms: 1, unit_type: '1 Bedroom', building: 'A', facing_direction: 'N', status: 'available', layout_description: 'ห้อง 1 นอน ชั้นสูงวิวโล่ง' },
    { unit_number: 'A-2002', floor_number: 20, price: 7500000, area_sqm: 65, bedrooms: 2, bathrooms: 2, unit_type: '2 Bedroom', building: 'A', facing_direction: 'S', status: 'available', layout_description: 'ห้อง 2 นอน 2 น้ำ ห้องกว้าง ครัวปิด' },
    { unit_number: 'A-2501', floor_number: 25, price: 8200000, area_sqm: 72, bedrooms: 2, bathrooms: 2, unit_type: '2 Bedroom', building: 'A', facing_direction: 'W', status: 'reserved', layout_description: 'ห้อง 2 นอน วิวแม่น้ำ ชั้นบนสุด' },
    { unit_number: 'A-2502', floor_number: 25, price: 8800000, area_sqm: 78, bedrooms: 2, bathrooms: 2, unit_type: '2 Bedroom Penthouse', building: 'A', facing_direction: 'NW', status: 'available', layout_description: 'ห้อง 2 นอน ห้องมุม Penthouse Floor' },
    { unit_number: 'B-0801', floor_number: 8, price: 6500000, area_sqm: 58, bedrooms: 2, bathrooms: 1, unit_type: '2 Bedroom', building: 'B', facing_direction: 'S', status: 'sold', layout_description: 'ห้อง 2 นอน 1 น้ำ ใกล้สระว่ายน้ำ' },
    { unit_number: 'B-0802', floor_number: 8, price: 6800000, area_sqm: 62, bedrooms: 2, bathrooms: 2, unit_type: '2 Bedroom', building: 'B', facing_direction: 'S', status: 'available', layout_description: 'ห้อง 2 นอน วิวสวน ทิศใต้' },
    { unit_number: 'B-1201', floor_number: 12, price: 9500000, area_sqm: 85, bedrooms: 3, bathrooms: 2, unit_type: '3 Bedroom', building: 'B', facing_direction: 'E', status: 'available', layout_description: 'ห้อง 3 นอน ขนาดใหญ่ มีระเบียง', balcony: true },
    { unit_number: 'B-1202', floor_number: 12, price: 10200000, area_sqm: 92, bedrooms: 3, bathrooms: 2, unit_type: '3 Bedroom', building: 'B', facing_direction: 'NE', status: 'reserved', layout_description: 'ห้อง 3 นอน ห้องมุม วิวป่า+เมือง', balcony: true },
    { unit_number: 'B-1801', floor_number: 18, price: 11500000, area_sqm: 98, bedrooms: 3, bathrooms: 2, unit_type: '3 Bedroom', building: 'B', facing_direction: 'N', status: 'available', layout_description: 'ห้อง 3 นอน ชั้นสูง Walk-in Closet', balcony: true },
    { unit_number: 'B-1802', floor_number: 18, price: 12000000, area_sqm: 105, bedrooms: 3, bathrooms: 3, unit_type: '3 Bedroom', building: 'B', facing_direction: 'N', status: 'sold', layout_description: 'ห้อง 3 นอน 3 น้ำ Fully Furnished', balcony: true },
    { unit_number: 'C-0501', floor_number: 5, price: 5500000, area_sqm: 52, bedrooms: 1, bathrooms: 1, unit_type: '1 Bedroom Garden', building: 'C', facing_direction: 'S', status: 'available', layout_description: 'ห้อง 1 นอน Garden View', garden: true },
    { unit_number: 'C-1001', floor_number: 10, price: 7800000, area_sqm: 68, bedrooms: 2, bathrooms: 2, unit_type: '2 Bedroom', building: 'C', facing_direction: 'W', status: 'available', layout_description: 'ห้อง 2 นอน วิวสระว่ายน้ำ Modern Luxury' },
    { unit_number: 'C-1501', floor_number: 15, price: 13500000, area_sqm: 115, bedrooms: 3, bathrooms: 3, unit_type: '3 Bedroom Premium', building: 'C', facing_direction: 'W', status: 'reserved', layout_description: 'ห้อง 3 นอน Premium Unit วิวแม่น้ำ', balcony: true },
    { unit_number: 'C-2001', floor_number: 20, price: 15000000, area_sqm: 125, bedrooms: 3, bathrooms: 3, unit_type: 'Sky Villa', building: 'C', facing_direction: 'NW', status: 'available', layout_description: 'ห้อง 3 นอน Sky Villa วิว 360 องศา', balcony: true },
    { unit_number: 'D-0101', floor_number: 1, price: 18500000, area_sqm: 145, bedrooms: 3, bathrooms: 3, unit_type: 'Duplex', building: 'D', facing_direction: 'S', status: 'available', layout_description: 'Duplex 2 ชั้น 3 นอน สวนหน้าบ้าน', garden: true },
    { unit_number: 'D-0102', floor_number: 1, price: 22000000, area_sqm: 168, bedrooms: 4, bathrooms: 4, unit_type: 'Duplex Pool Villa', building: 'D', facing_direction: 'S', status: 'reserved', layout_description: 'Duplex 2 ชั้น 4 นอน สระส่วนตัว', garden: true, pool: true },
  ];

  const unitsToInsert = sampleUnits.map(unit => ({
    tenant_id: TENANT_ID,
    project_id: PROPERTY_ID,
    ...unit,
    price_per_sqm: Math.round(unit.price / unit.area_sqm),
    parking_spaces: unit.bedrooms >= 2 ? 1 : 0,
    images: [],
    balcony: unit.balcony || false,
    garden: unit.garden || false,
    pool: unit.pool || false
  }));

  response = await fetch(SUPABASE_URL + '/rest/v1/units', {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(unitsToInsert)
  });

  result = await response.text();

  if (response.ok) {
    const data = JSON.parse(result);
    console.log('✅ สร้างยูนิตสำเร็จ', data.length, 'ยูนิต!');

    const available = data.filter(u => u.status === 'available').length;
    const reserved = data.filter(u => u.status === 'reserved').length;
    const sold = data.filter(u => u.status === 'sold').length;

    console.log('\n📊 สรุปสถานะยูนิต:');
    console.log('🟢 ว่าง:', available, 'ยูนิต');
    console.log('🟡 จอง:', reserved, 'ยูนิต');
    console.log('🔴 ขายแล้ว:', sold, 'ยูนิต');

    console.log('\n🏠 รายการยูนิตทั้งหมด:');
    data.sort((a, b) => a.unit_number.localeCompare(b.unit_number)).forEach(u => {
      const icon = u.status === 'available' ? '🟢' : u.status === 'reserved' ? '🟡' : '🔴';
      const bed = u.bedrooms === 0 ? 'Studio' : u.bedrooms + ' นอน';
      console.log(icon, u.unit_number.padEnd(8), '|', bed.padEnd(8), '|', u.area_sqm.toString().padStart(3), 'ตร.ม. |', (u.price/1000000).toFixed(1).padStart(5), 'ล้าน');
    });
  } else {
    console.log('❌ Error:', response.status, result);
  }
}

createProjectAndUnits().catch(console.error);
