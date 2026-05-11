-- Demo image seeder — using ONLY Unsplash IDs verified to load in user screenshots
-- Smaller pool = more duplication but no broken images

WITH unit_imgs AS (
  SELECT
    u.id,
    CASE
      WHEN u.pool THEN ARRAY[
        'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop'
      ]::text[]

      WHEN p.type = 'single_house' AND u.floor_count = 3 THEN ARRAY[
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop'
      ]::text[]

      WHEN p.type = 'single_house' THEN ARRAY[
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1583608205776-bfd35f0d9f83?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1494526585095-c41746248156?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop'
      ]::text[]

      WHEN p.type = 'condo' AND u.floor_number >= 16 AND u.balcony THEN ARRAY[
        'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1580216643062-cf460548a66a?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=800&h=600&fit=crop'
      ]::text[]

      WHEN p.type = 'condo' AND u.balcony THEN ARRAY[
        'https://images.unsplash.com/photo-1554995207-c18c203602cb?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&h=600&fit=crop'
      ]::text[]

      WHEN p.type = 'condo' THEN ARRAY[
        'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=600&fit=crop'
      ]::text[]

      ELSE ARRAY[
        'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800&h=600&fit=crop'
      ]::text[]
    END AS imgs
  FROM units u
  JOIN properties p ON p.id = u.project_id
)
UPDATE units u
SET
  thumbnail_url = ui.imgs[1 + (abs(hashtext(u.id::text)) % array_length(ui.imgs, 1))],
  images = jsonb_build_array(
    ui.imgs[1 + (abs(hashtext(u.id::text)) % array_length(ui.imgs, 1))]
  )
FROM unit_imgs ui
WHERE u.id = ui.id;
