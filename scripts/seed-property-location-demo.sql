-- Seed location + master plan + nearby for 3 sample projects

-- Baan Issara (สมุทรปราการ, บางพลี) — coordinates near ถนนกาญจนาภิเษก
UPDATE properties SET
  location_lat = 13.6358,
  location_lng = 100.7058,
  master_plan_url = 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=1600&h=900&fit=crop',
  nearby = '[
    {"name": "เซ็นทรัล บางนา", "type": "shopping", "distance_km": 5},
    {"name": "BTS แบริ่ง", "type": "transit", "distance_km": 8},
    {"name": "รพ.บางนา", "type": "hospital", "distance_km": 3},
    {"name": "ISB International School", "type": "school", "distance_km": 4},
    {"name": "Mega Bangna", "type": "shopping", "distance_km": 6},
    {"name": "สนามบินสุวรรณภูมิ", "type": "airport", "distance_km": 12}
  ]'::jsonb
WHERE name = 'Baan Issara';

-- Sasara Hua Hin
UPDATE properties SET
  location_lat = 12.5684,
  location_lng = 99.9577,
  master_plan_url = 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1600&h=900&fit=crop',
  nearby = '[
    {"name": "หาดหัวหิน", "type": "beach", "distance_km": 1},
    {"name": "Bluport Hua Hin", "type": "shopping", "distance_km": 2},
    {"name": "ตลาดโต้รุ่งหัวหิน", "type": "market", "distance_km": 1.5},
    {"name": "สถานีรถไฟหัวหิน", "type": "transit", "distance_km": 2},
    {"name": "รพ.กรุงเทพหัวหิน", "type": "hospital", "distance_km": 3},
    {"name": "Black Mountain Golf", "type": "leisure", "distance_km": 8}
  ]'::jsonb
WHERE name = 'Sasara Hua Hin';

-- The Issara Chiang Mai
UPDATE properties SET
  location_lat = 18.7883,
  location_lng = 98.9853,
  master_plan_url = 'https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=1600&h=900&fit=crop',
  nearby = '[
    {"name": "เซ็นทรัล เชียงใหม่ แอร์พอร์ต", "type": "shopping", "distance_km": 4},
    {"name": "สนามบินเชียงใหม่", "type": "airport", "distance_km": 5},
    {"name": "วัดพระธาตุดอยสุเทพ", "type": "landmark", "distance_km": 14},
    {"name": "ม.เชียงใหม่", "type": "school", "distance_km": 6},
    {"name": "Maya Lifestyle Shopping Center", "type": "shopping", "distance_km": 3},
    {"name": "รพ.มหาราชนครเชียงใหม่", "type": "hospital", "distance_km": 5}
  ]'::jsonb
WHERE name = 'The Issara Chiang Mai';
