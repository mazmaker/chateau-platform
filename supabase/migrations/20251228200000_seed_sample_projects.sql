-- Seed 20 Sample Projects for CHATEAU Platform
-- This migration creates sample real estate projects for testing

-- Get the first tenant_id from the database
DO $$
DECLARE
    v_tenant_id uuid;
BEGIN
    -- Get the first tenant
    SELECT id INTO v_tenant_id FROM tenants LIMIT 1;

    IF v_tenant_id IS NULL THEN
        RAISE NOTICE 'No tenant found. Skipping project seed data.';
        RETURN;
    END IF;

    -- Insert 20 sample projects

    -- Project 1: THE FORESTIAS
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'THE FORESTIAS',
        'condo',
        'โครงการที่อยู่อาศัยแบบผสมผสานที่ใหญ่ที่สุดในเอเชียตะวันออกเฉียงใต้ พร้อมป่าใน โครงการ 30 ไร่',
        'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800',
        '["https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800", "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=800"]',
        500, 45, true,
        '{"street": "88 ถนนบางนา-ตราด กม.7", "sub_district": "บางแก้ว", "district": "บางพลี", "province": "สมุทรปราการ", "postal_code": "10540", "country": "ประเทศไทย"}',
        15000000, 'THB',
        2, NULL, NULL,
        'MQDC', '[]',
        '{"sale_kit": "https://example.com/forestias-kit", "fact_sheet": "https://example.com/forestias-fact"}',
        true, true, 4, 2, 2, 85
    );

    -- Project 2: ONE BANGKOK
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'ONE BANGKOK RESIDENCES',
        'condo',
        'โครงการมิกซ์ยูสระดับโลกใจกลางกรุงเทพฯ ติดสวนลุมพินี',
        'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800',
        '["https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800"]',
        300, 68, true,
        '{"street": "ถนนวิทยุ แยกลุมพินี", "sub_district": "ลุมพินี", "district": "ปทุมวัน", "province": "กรุงเทพมหานคร", "postal_code": "10330", "country": "ประเทศไทย"}',
        45000000, 'THB',
        1, NULL, NULL,
        'TCC Assets', '[]',
        '{"sale_kit": null, "fact_sheet": null}',
        true, true, 4, 3, 3, 150
    );

    -- Project 3: WHIZDOM 101
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'WHIZDOM 101',
        'condo',
        'คอนโดมิเนียมติด BTS ปุณณวิถี โครงการใหม่ล่าสุดจาก MQDC',
        'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=800',
        '["https://images.unsplash.com/photo-1460317442991-0ec209397118?w=800"]',
        800, 52, true,
        '{"street": "ซอยสุขุมวิท 101", "sub_district": "บางจาก", "district": "พระโขนง", "province": "กรุงเทพมหานคร", "postal_code": "10260", "country": "ประเทศไทย"}',
        3500000, 'THB',
        1, NULL, NULL,
        'MQDC', '[]',
        '{}',
        true, false, 2, 1, 1, 28
    );

    -- Project 4: THE LINE PHAHOL-PRADIPAT
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'THE LINE PHAHOL-PRADIPAT',
        'condo',
        'คอนโดหรูใกล้ BTS สะพานควาย พร้อมวิวสวนจตุจักร',
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800',
        '["https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800"]',
        650, 48, true,
        '{"street": "ถนนพหลโยธิน ซอย 8", "sub_district": "สามเสนใน", "district": "พญาไท", "province": "กรุงเทพมหานคร", "postal_code": "10400", "country": "ประเทศไทย"}',
        5500000, 'THB',
        1, NULL, NULL,
        'Sansiri', '[]',
        '{}',
        true, false, 2, 1, 1, 35
    );

    -- Project 5: SETTHASIRI KRUNGTHEP KREETHA
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'SETTHASIRI KRUNGTHEP KREETHA',
        'single_house',
        'บ้านเดี่ยวหรู โครงการคุณภาพจาก SANSIRI ทำเลกรุงเทพกรีฑา',
        'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800',
        '["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800"]',
        150, 2, true,
        '{"street": "ถนนกรุงเทพกรีฑา", "sub_district": "สะพานสูง", "district": "สะพานสูง", "province": "กรุงเทพมหานคร", "postal_code": "10250", "country": "ประเทศไทย"}',
        18000000, 'THB',
        1, NULL, NULL,
        'Sansiri', '[]',
        '{}',
        true, true, 6, 4, 4, 280
    );

    -- Project 6: GRAND BANGKOK BOULEVARD RATCHADA
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'GRAND BANGKOK BOULEVARD RATCHADA',
        'single_house',
        'บ้านเดี่ยวระดับ Luxury บนถนนรัชดาภิเษก',
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800',
        '["https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800"]',
        80, 3, true,
        '{"street": "ถนนรัชดาภิเษก", "sub_district": "ห้วยขวาง", "district": "ห้วยขวาง", "province": "กรุงเทพมหานคร", "postal_code": "10310", "country": "ประเทศไทย"}',
        35000000, 'THB',
        1, NULL, NULL,
        'SC Asset', '[]',
        '{}',
        true, false, 8, 5, 5, 450
    );

    -- Project 7: BAAN SANSIRI PATTANAKARN
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'BAAN SANSIRI PATTANAKARN',
        'single_house',
        'บ้านเดี่ยวหรูหราพัฒนาการ ใกล้ Airport Link',
        'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800',
        '["https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800"]',
        120, 2, true,
        '{"street": "ถนนพัฒนาการ 30", "sub_district": "สวนหลวง", "district": "สวนหลวง", "province": "กรุงเทพมหานคร", "postal_code": "10250", "country": "ประเทศไทย"}',
        22000000, 'THB',
        1, NULL, NULL,
        'Sansiri', '[]',
        '{}',
        true, false, 6, 4, 3, 320
    );

    -- Project 8: PLENO PINKLAO-PHETKASEM
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'PLENO PINKLAO-PHETKASEM',
        'townhome',
        'ทาวน์โฮมโครงการใหม่ ทำเลปิ่นเกล้า-เพชรเกษม ใกล้ MRT',
        'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800',
        '["https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800"]',
        200, 3, true,
        '{"street": "ถนนเพชรเกษม 69", "sub_district": "หลักสอง", "district": "บางแค", "province": "กรุงเทพมหานคร", "postal_code": "10160", "country": "ประเทศไทย"}',
        4500000, 'THB',
        1, NULL, NULL,
        'AP Thailand', '[]',
        '{}',
        true, false, 4, 3, 2, 120
    );

    -- Project 9: THE CONNECT KASET-NAWAMIN
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'THE CONNECT KASET-NAWAMIN',
        'townhome',
        'ทาวน์โฮม 3 ชั้น ใกล้ทางด่วนฉลองรัช ราคาเริ่มต้น 3.9 ล้าน',
        'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800',
        '["https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=800"]',
        180, 3, true,
        '{"street": "ถนนนวมินทร์ 74", "sub_district": "คลองกุ่ม", "district": "บึงกุ่ม", "province": "กรุงเทพมหานคร", "postal_code": "10240", "country": "ประเทศไทย"}',
        3900000, 'THB',
        1, NULL, NULL,
        'LH', '[]',
        '{}',
        true, false, 4, 3, 2, 110
    );

    -- Project 10: SUPALAI VERANDA RAMA 9
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'SUPALAI VERANDA RAMA 9',
        'condo',
        'คอนโด Low Rise ติดถนนพระราม 9 ใกล้ MRT พระราม 9',
        'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=800',
        '["https://images.unsplash.com/photo-1515263487990-61b07816b324?w=800"]',
        450, 8, true,
        '{"street": "ถนนพระราม 9", "sub_district": "ห้วยขวาง", "district": "ห้วยขวาง", "province": "กรุงเทพมหานคร", "postal_code": "10310", "country": "ประเทศไทย"}',
        2800000, 'THB',
        1, NULL, NULL,
        'Supalai', '[]',
        '{}',
        true, false, 2, 1, 1, 32
    );

    -- Project 11: LIFE SATHORN SIERRA
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'LIFE SATHORN SIERRA',
        'condo',
        'คอนโดหรูติด BTS ตลาดพลู ทำเลสาทร',
        'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800',
        '["https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=800"]',
        600, 35, true,
        '{"street": "ถนนกรุงธนบุรี", "sub_district": "คลองต้นไทร", "district": "คลองสาน", "province": "กรุงเทพมหานคร", "postal_code": "10600", "country": "ประเทศไทย"}',
        4200000, 'THB',
        1, NULL, NULL,
        'AP Thailand', '[]',
        '{}',
        true, false, 2, 1, 1, 30
    );

    -- Project 12: IDEO MOBI SUKHUMVIT
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'IDEO MOBI SUKHUMVIT 66',
        'condo',
        'คอนโดติด BTS อุดมสุข ทำเลสุขุมวิท 66',
        'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800',
        '["https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800"]',
        550, 32, true,
        '{"street": "ซอยสุขุมวิท 66", "sub_district": "บางจาก", "district": "พระโขนง", "province": "กรุงเทพมหานคร", "postal_code": "10260", "country": "ประเทศไทย"}',
        3800000, 'THB',
        1, NULL, NULL,
        'Ananda', '[]',
        '{}',
        true, false, 2, 1, 1, 28
    );

    -- Project 13: NUSA CHIVANI PATTAYA
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'NUSA CHIVANI PATTAYA',
        'single_house',
        'บ้านพักตากอากาศหรูริมหาดพัทยา Pool Villa สไตล์บาหลี',
        'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800',
        '["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800"]',
        50, 2, true,
        '{"street": "ถนนพัทยาสาย 3", "sub_district": "หนองปรือ", "district": "บางละมุง", "province": "ชลบุรี", "postal_code": "20150", "country": "ประเทศไทย"}',
        25000000, 'THB',
        11, NULL, NULL,
        'Nova Group', '[]',
        '{}',
        true, true, 8, 4, 5, 400
    );

    -- Project 14: CHAAN RESIDENCE HUA HIN
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'CHAAN RESIDENCE HUA HIN',
        'condo',
        'คอนโดหรูริมทะเลหัวหิน วิวทะเลพาโนรามา',
        'https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800',
        '["https://images.unsplash.com/photo-1567767292278-a4f21aa2d36e?w=800"]',
        200, 25, true,
        '{"street": "ถนนเพชรเกษม", "sub_district": "หัวหิน", "district": "หัวหิน", "province": "ประจวบคีรีขันธ์", "postal_code": "77110", "country": "ประเทศไทย"}',
        8500000, 'THB',
        54, NULL, NULL,
        'Chaan Development', '[]',
        '{}',
        true, false, 4, 2, 2, 75
    );

    -- Project 15: MANTANA BANGNA KM.7
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'MANTANA BANGNA KM.7',
        'twin_house',
        'บ้านแฝดหรู โครงการคุณภาพจาก Land & Houses',
        'https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800',
        '["https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?w=800"]',
        100, 2, true,
        '{"street": "ถนนบางนา-ตราด กม.7", "sub_district": "บางแก้ว", "district": "บางพลี", "province": "สมุทรปราการ", "postal_code": "10540", "country": "ประเทศไทย"}',
        6500000, 'THB',
        2, NULL, NULL,
        'Land & Houses', '[]',
        '{}',
        true, false, 4, 3, 3, 180
    );

    -- Project 16: HABITOWN TIWANON
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'HABITOWN TIWANON',
        'townhome',
        'ทาวน์โฮม 2 ชั้น ใกล้ MRT ศูนย์ราชการนนทบุรี',
        'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800',
        '["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800"]',
        160, 2, true,
        '{"street": "ถนนติวานนท์", "sub_district": "ตลาดขวัญ", "district": "เมืองนนทบุรี", "province": "นนทบุรี", "postal_code": "11000", "country": "ประเทศไทย"}',
        3200000, 'THB',
        3, NULL, NULL,
        'SC Asset', '[]',
        '{}',
        true, false, 4, 3, 2, 100
    );

    -- Project 17: THE ORIGIN ONNUT
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'THE ORIGIN ONNUT',
        'condo',
        'คอนโดราคาเริ่มต้น 1.99 ล้าน ใกล้ BTS อ่อนนุช',
        'https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800',
        '["https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800"]',
        700, 28, true,
        '{"street": "ซอยอ่อนนุช 44", "sub_district": "พระโขนง", "district": "พระโขนง", "province": "กรุงเทพมหานคร", "postal_code": "10260", "country": "ประเทศไทย"}',
        1990000, 'THB',
        1, NULL, NULL,
        'Origin Property', '[]',
        '{}',
        true, false, 2, 1, 1, 24
    );

    -- Project 18: PRUKSA VILLE RANGSIT
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'PRUKSA VILLE RANGSIT KLONG 3',
        'townhome',
        'ทาวน์โฮม 2 ชั้น ราคาเริ่มต้น 1.79 ล้าน ใกล้มหาวิทยาลัยธรรมศาสตร์',
        'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800',
        '["https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800"]',
        300, 2, true,
        '{"street": "ถนนรังสิต-นครนายก คลอง 3", "sub_district": "ประชาธิปัตย์", "district": "ธัญบุรี", "province": "ปทุมธานี", "postal_code": "12130", "country": "ประเทศไทย"}',
        1790000, 'THB',
        4, NULL, NULL,
        'Pruksa Real Estate', '[]',
        '{}',
        true, false, 4, 3, 2, 95
    );

    -- Project 19: NOBLE RECOLE SUKHUMVIT 19
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'NOBLE RECOLE SUKHUMVIT 19',
        'condo',
        'คอนโดหรูใจกลางสุขุมวิท ใกล้ BTS อโศก และ MRT สุขุมวิท',
        'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800',
        '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800"]',
        250, 42, true,
        '{"street": "ซอยสุขุมวิท 19", "sub_district": "คลองเตยเหนือ", "district": "วัฒนา", "province": "กรุงเทพมหานคร", "postal_code": "10110", "country": "ประเทศไทย"}',
        12500000, 'THB',
        1, NULL, NULL,
        'Noble Development', '[]',
        '{}',
        true, true, 4, 2, 2, 65
    );

    -- Project 20: CENTRO WESTGATE
    INSERT INTO properties (
        tenant_id, name, type, description, thumbnail_url, images,
        total_units, floor_count, has_facilities,
        address, base_price, currency,
        province_id, district_id, sub_district_id,
        developer, attachments, information_links,
        is_active, is_featured, max_guests, bedrooms, bathrooms, size_sqft
    ) VALUES (
        v_tenant_id,
        'CENTRO WESTGATE',
        'townhome',
        'ทาวน์โฮม 3 ชั้น ใกล้ Central Westgate เดินทางสะดวก',
        'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800',
        '["https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800"]',
        220, 3, true,
        '{"street": "ถนนรัตนาธิเบศร์", "sub_district": "บางกระสอ", "district": "เมืองนนทบุรี", "province": "นนทบุรี", "postal_code": "11000", "country": "ประเทศไทย"}',
        4800000, 'THB',
        3, NULL, NULL,
        'AP Thailand', '[]',
        '{}',
        true, false, 4, 3, 3, 140
    );

    RAISE NOTICE 'Successfully inserted 20 sample projects for tenant %', v_tenant_id;
END $$;
