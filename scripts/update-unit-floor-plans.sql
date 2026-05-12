-- Update floor_plan_url with REAL single-unit floor plans (dollhouse views)
-- These are 3D cutaway views of individual unit interiors — clearly different from
-- master plan (which shows the whole project from above).

-- 1BR / Studio / small condos → use 1-bedroom dollhouse
UPDATE units u
SET floor_plan_url = 'https://cdn.fazwaz.com/wbr/gR6HhADa_eQVSevjpfA-mweYsXE/0x0/gallery/170058/sasara-hua-hin-1br-u1365340-dollhouse-view.jpg'
FROM properties p
WHERE u.project_id = p.id
  AND p.name = 'Sasara Hua Hin'
  AND COALESCE(u.bedrooms, 0) <= 1;

-- 2BR+ condos / penthouse / sky villa → use 2-bedroom dollhouse
UPDATE units u
SET floor_plan_url = 'https://cdn.fazwaz.com/wbr/8j7Hwt-ALUkHtmDJfm1-LzNJLp8/0x0/gallery/170060/sasara-hua-hin-2br-u1365342-dollhouse-view.jpg'
FROM properties p
WHERE u.project_id = p.id
  AND p.name = 'Sasara Hua Hin'
  AND COALESCE(u.bedrooms, 0) >= 2;

-- Baan Issara houses — also use 2BR dollhouse as placeholder
-- (real production should replace with actual house floor plan from architect)
UPDATE units u
SET floor_plan_url = 'https://cdn.fazwaz.com/wbr/8j7Hwt-ALUkHtmDJfm1-LzNJLp8/0x0/gallery/170060/sasara-hua-hin-2br-u1365342-dollhouse-view.jpg'
FROM properties p
WHERE u.project_id = p.id
  AND p.name = 'Baan Issara'
  AND u.floor_plan_url IS NOT NULL;
