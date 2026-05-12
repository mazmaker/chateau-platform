-- Seed real floor plan URLs + Matterport 3D tour URLs for demo units
-- Floor plans from fazwaz CDN (Sasara Hua Hin actual floor plans)
-- 3D tours from Matterport public demo gallery

-- ───── Sasara Hua Hin condo units — use actual fazwaz floor plans ─────
UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/-1L1u4XJoTCuRkhreYE8Xm16D0k/0x0/project/102238/screenshot-2023-01-05-144308.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=P9cgFFtBnqC'
WHERE unit_number IN ('A0320', 'A0719')
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');

UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/E2K5PmjS2dhhx1DweUSbywSKmTk/0x0/project/102238/screenshot-2023-01-05-144346.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=JGPnGQ6hosj'
WHERE unit_number IN ('A2818', 'B1405')
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');

UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/HDYU-8iHe1Sj4c8drYoyTfzmVHA/0x0/project/102238/screenshot-2023-01-05-144402.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=P9cgFFtBnqC'
WHERE unit_number IN ('B1702', 'B2116', 'C0201')
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');

UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/QcpSUc-Cs1e7tV6YGd4GRIT8Uus/0x0/project/102238/screenshot-2023-01-05-144432.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=JGPnGQ6hosj'
WHERE unit_number IN ('C1920', 'D1511', 'D2401')
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');

-- ───── Baan Issara house units — use fazwaz floor plan as placeholder ─────
-- Different houses get different floor plans
UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/-1L1u4XJoTCuRkhreYE8Xm16D0k/0x0/project/102238/screenshot-2023-01-05-144308.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=JGPnGQ6hosj'
WHERE unit_number IN ('12/143', '34/171', '45/76')
  AND project_id = (SELECT id FROM properties WHERE name='Baan Issara');

UPDATE units SET
  floor_plan_url = 'https://cdn.fazwaz.com/wbr/E2K5PmjS2dhhx1DweUSbywSKmTk/0x0/project/102238/screenshot-2023-01-05-144346.jpg',
  tour_3d_url = 'https://my.matterport.com/show/?m=P9cgFFtBnqC'
WHERE unit_number IN ('46/138', '46/46')
  AND project_id = (SELECT id FROM properties WHERE name='Baan Issara');
