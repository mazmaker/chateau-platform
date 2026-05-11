-- Seed location + master plan + nearby for remaining 11 projects with units
-- Coordinates approximate from district/province
-- Master plans use placeholder service (admin can replace via Edit form)

-- ───── Bangkok urban ─────
UPDATE properties SET
  location_lat = 13.7563, location_lng = 100.6431,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+Baan+Issara+Rama9'),
  nearby = '[
    {"name": "เซ็นทรัล พระราม 9", "type": "shopping", "distance_km": 3},
    {"name": "MRT พระราม 9", "type": "transit", "distance_km": 2.5},
    {"name": "รพ.พระราม 9", "type": "hospital", "distance_km": 2},
    {"name": "Fortune Town", "type": "shopping", "distance_km": 4},
    {"name": "สนามบินสุวรรณภูมิ", "type": "airport", "distance_km": 25},
    {"name": "รร.สาธิตจุฬา", "type": "school", "distance_km": 5}
  ]'::jsonb
WHERE name = 'Baan Issara Rama9';

UPDATE properties SET
  location_lat = 13.7700, location_lng = 100.5760,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+Issara+Residence'),
  nearby = '[
    {"name": "เซ็นทรัล แกรนด์ พระราม 9", "type": "shopping", "distance_km": 2.5},
    {"name": "MRT ห้วยขวาง", "type": "transit", "distance_km": 1},
    {"name": "รพ.พระราม 9", "type": "hospital", "distance_km": 2},
    {"name": "RCA", "type": "leisure", "distance_km": 3},
    {"name": "Bangkok Hospital", "type": "hospital", "distance_km": 3.5},
    {"name": "ม.รามคำแหง", "type": "school", "distance_km": 5}
  ]'::jsonb
WHERE name = 'Issara Residence';

UPDATE properties SET
  location_lat = 13.7563, location_lng = 100.6431,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+Issara+Residence+Rama9'),
  nearby = '[
    {"name": "เซ็นทรัล พระราม 9", "type": "shopping", "distance_km": 3},
    {"name": "MRT พระราม 9", "type": "transit", "distance_km": 2.5},
    {"name": "รพ.พระราม 9", "type": "hospital", "distance_km": 2.5},
    {"name": "Fortune Town", "type": "shopping", "distance_km": 4},
    {"name": "สนามบินสุวรรณภูมิ", "type": "airport", "distance_km": 25}
  ]'::jsonb
WHERE name = 'Issara Residence Rama9';

UPDATE properties SET
  location_lat = 13.7234, location_lng = 100.5294,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+The+Issara+Sathorn'),
  nearby = '[
    {"name": "เซ็นทรัล สีลม", "type": "shopping", "distance_km": 2},
    {"name": "BTS สาทร", "type": "transit", "distance_km": 0.5},
    {"name": "รพ.เลิดสิน", "type": "hospital", "distance_km": 1.5},
    {"name": "ICONSIAM", "type": "shopping", "distance_km": 4},
    {"name": "Lumpini Park", "type": "leisure", "distance_km": 2.5},
    {"name": "ม.อัสสัมชัญ", "type": "school", "distance_km": 3}
  ]'::jsonb
WHERE name = 'The Issara';

-- ───── Hua Hin / Cha-am beach ─────
UPDATE properties SET
  location_lat = 12.7906, location_lng = 99.9803,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/fef3c7/92400e?text=Master+Plan+%E2%80%94+Baan+Thew+Talay'),
  nearby = '[
    {"name": "หาดชะอำ", "type": "beach", "distance_km": 1},
    {"name": "Santorini Park", "type": "leisure", "distance_km": 5},
    {"name": "Cha-Am Beach Market", "type": "market", "distance_km": 2},
    {"name": "สนามบินหัวหิน", "type": "airport", "distance_km": 15},
    {"name": "รพ.ชะอำ", "type": "hospital", "distance_km": 4}
  ]'::jsonb
WHERE name = 'Baan Thew Talay Blue Sapphire';

UPDATE properties SET
  location_lat = 12.7950, location_lng = 99.9820,
  nearby = COALESCE(nearby, '[
    {"name": "หาดชะอำ", "type": "beach", "distance_km": 1},
    {"name": "Santorini Park", "type": "leisure", "distance_km": 5},
    {"name": "Bluport Hua Hin", "type": "shopping", "distance_km": 8},
    {"name": "Black Mountain Golf", "type": "leisure", "distance_km": 10},
    {"name": "รพ.ชะอำ", "type": "hospital", "distance_km": 3}
  ]'::jsonb)
WHERE name = 'Blu Diamond';

UPDATE properties SET
  location_lat = 12.5707, location_lng = 99.9580,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/fef3c7/92400e?text=Master+Plan+%E2%80%94+Issara+Ville+Hua+Hin'),
  nearby = '[
    {"name": "หาดหัวหิน", "type": "beach", "distance_km": 1.5},
    {"name": "Bluport Hua Hin", "type": "shopping", "distance_km": 2},
    {"name": "ตลาดโต้รุ่งหัวหิน", "type": "market", "distance_km": 2},
    {"name": "สถานีรถไฟหัวหิน", "type": "transit", "distance_km": 2.5},
    {"name": "Black Mountain Golf", "type": "leisure", "distance_km": 8},
    {"name": "รพ.กรุงเทพหัวหิน", "type": "hospital", "distance_km": 3}
  ]'::jsonb
WHERE name = 'Issara Ville Hua Hin';

UPDATE properties SET
  location_lat = 12.5700, location_lng = 99.9590,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/fef3c7/92400e?text=Master+Plan+%E2%80%94+Sasa+Hua+Hin'),
  nearby = '[
    {"name": "หาดหัวหิน", "type": "beach", "distance_km": 1},
    {"name": "Bluport Hua Hin", "type": "shopping", "distance_km": 2},
    {"name": "Cicada Market", "type": "market", "distance_km": 3},
    {"name": "สถานีรถไฟหัวหิน", "type": "transit", "distance_km": 2},
    {"name": "Hua Hin Hills Vineyard", "type": "leisure", "distance_km": 12},
    {"name": "รพ.กรุงเทพหัวหิน", "type": "hospital", "distance_km": 3}
  ]'::jsonb
WHERE name = 'Sasa Hua Hin';

-- ───── เขาใหญ่ / ปากช่อง ─────
UPDATE properties SET
  location_lat = 14.6650, location_lng = 101.4180,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dcfce7/166534?text=Master+Plan+%E2%80%94+Baan+Sita+Wan'),
  nearby = '[
    {"name": "อุทยานเขาใหญ่", "type": "landmark", "distance_km": 8},
    {"name": "PB Valley Khao Yai Winery", "type": "leisure", "distance_km": 6},
    {"name": "ตลาดน้ำสีคิ้ว", "type": "market", "distance_km": 12},
    {"name": "Toscana Valley", "type": "leisure", "distance_km": 5},
    {"name": "รพ.ปากช่อง", "type": "hospital", "distance_km": 10},
    {"name": "Khao Yai Art Museum", "type": "landmark", "distance_km": 7}
  ]'::jsonb
WHERE name = 'Baan Sita Wan';

-- ───── สมุทรปราการ ─────
UPDATE properties SET
  location_lat = 13.6184, location_lng = 100.6968,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dbeafe/1e40af?text=Master+Plan+%E2%80%94+THE+FORESTIAS'),
  nearby = '[
    {"name": "Mega Bangna", "type": "shopping", "distance_km": 4},
    {"name": "IKEA Bangna", "type": "shopping", "distance_km": 4.5},
    {"name": "BTS แบริ่ง", "type": "transit", "distance_km": 7},
    {"name": "สนามบินสุวรรณภูมิ", "type": "airport", "distance_km": 10},
    {"name": "ISB International School", "type": "school", "distance_km": 3},
    {"name": "รพ.สมิติเวช ศรีนครินทร์", "type": "hospital", "distance_km": 6}
  ]'::jsonb
WHERE name = 'THE FORESTIAS';

-- ───── เชียงใหม่ ─────
UPDATE properties SET
  location_lat = 18.7283, location_lng = 98.9416,
  master_plan_url = COALESCE(master_plan_url, 'https://placehold.co/1600x900/dcfce7/166534?text=Master+Plan+%E2%80%94+%E0%B8%9A%E0%B9%89%E0%B8%B2%E0%B8%99%E0%B8%A1%E0%B8%B5%E0%B8%AA%E0%B8%B8%E0%B8%82'),
  nearby = '[
    {"name": "Royal Park Rajapruek", "type": "landmark", "distance_km": 5},
    {"name": "Hang Dong Market", "type": "market", "distance_km": 2},
    {"name": "สนามบินเชียงใหม่", "type": "airport", "distance_km": 12},
    {"name": "เซ็นทรัล เชียงใหม่ แอร์พอร์ต", "type": "shopping", "distance_km": 14},
    {"name": "Grand Canyon Chiang Mai", "type": "leisure", "distance_km": 8},
    {"name": "ม.แม่โจ้", "type": "school", "distance_km": 25}
  ]'::jsonb
WHERE name = 'บ้านมีสุข';
