-- Seed 3 representative units so user can preview PROPERTY HUB-style detail page
-- Picks: one house with promo, one mid-floor condo, one pool villa-ish (Sasara Hua Hin)

-- 1. Baan Issara 12/143 — บ้านเดี่ยว 3 ชั้น, ลดราคา, view สวน
UPDATE units SET
  promo_price = 38000000,
  plot_number = 'BI-12',
  view = 'สวนกลางโครงการ + ทิศเหนือ',
  furnishing = 'partial',
  floor_plan_url = 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=900&fit=crop',
  tour_3d_url = 'https://my.matterport.com/show/?m=demo-house'
WHERE unit_number = '12/143'
  AND project_id = (SELECT id FROM properties WHERE name='Baan Issara');

-- 2. Sasara Hua Hin A0719 — คอนโด 7 ชั้น, fully furnished
UPDATE units SET
  promo_price = 3700000,
  plot_number = 'A-0719',
  view = 'วิวสระว่ายน้ำส่วนกลาง',
  furnishing = 'fully',
  floor_plan_url = 'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=1200&h=900&fit=crop'
WHERE unit_number = 'A0719'
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');

-- 3. Sasara Hua Hin B2116 — คอนโดชั้น 21, วิวเมือง, fully furnished พรีเมียม
UPDATE units SET
  promo_price = NULL,
  plot_number = 'B-2116',
  view = 'วิวทะเล 270° ชั้นสูง',
  furnishing = 'fully',
  floor_plan_url = 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1200&h=900&fit=crop',
  tour_3d_url = 'https://my.matterport.com/show/?m=demo-condo-skyview'
WHERE unit_number = 'B2116'
  AND project_id = (SELECT id FROM properties WHERE name='Sasara Hua Hin');
