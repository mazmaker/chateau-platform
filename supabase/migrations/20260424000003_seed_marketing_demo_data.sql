-- Seed demo marketing data into real DB tables
-- Scope: Content/News distribution สำหรับ real estate (NO vouchers)
-- Run AFTER 20260424000002_create_marketing_tables.sql

-- ============================================================================
-- Helper: get the first tenant id for seeding
-- ============================================================================
DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'No tenant found — skipping seed';
    RETURN;
  END IF;
  SELECT id INTO v_user_id FROM users WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1;

  -- ==========================================================================
  -- SEGMENTS — 10 customer segments
  -- ==========================================================================
  INSERT INTO segments (tenant_id, code, name, description, filter_rules, member_count, created_by) VALUES
    (v_tenant_id, 'income_high',   'รายได้สูง',         'ลูกค้ารายได้ > 100k/เดือน',     '{"income_min": 100000}',                       1247, v_user_id),
    (v_tenant_id, 'income_medium', 'รายได้ปานกลาง',     'ลูกค้ารายได้ 30k-100k/เดือน',  '{"income_min": 30000, "income_max": 100000}',  3210, v_user_id),
    (v_tenant_id, 'income_low',    'รายได้น้อย',        'ลูกค้ารายได้ < 30k/เดือน',     '{"income_max": 30000}',                        1820, v_user_id),
    (v_tenant_id, 'age_young',     'กลุ่มอายุน้อย',     'อายุ 18-30 ปี',                '{"age_range": [18, 30]}',                      892,  v_user_id),
    (v_tenant_id, 'age_middle',    'วัยกลางคน',         'อายุ 31-50 ปี',                '{"age_range": [31, 50]}',                      2480, v_user_id),
    (v_tenant_id, 'age_senior',    'ผู้สูงอายุ',        'อายุ 51+ ปี',                  '{"age_range": [51, 99]}',                      720,  v_user_id),
    (v_tenant_id, 'first_home',    'บ้านหลังแรก',       'ลูกค้าซื้อบ้านครั้งแรก',        '{"buyer_type": "first_home"}',                 1102, v_user_id),
    (v_tenant_id, 'investment',    'ลงทุน/เก็งกำไร',    'ซื้อเพื่อลงทุน',                '{"buyer_type": "investment"}',                 423,  v_user_id),
    (v_tenant_id, 'family',        'ครอบครัว',          'ครอบครัว 2+ คน',              '{"household_size_min": 2}',                    1820, v_user_id)
  ON CONFLICT (tenant_id, code) DO NOTHING;

  -- ==========================================================================
  -- TRIGGERS — 6 marketing automation rules (content distribution focus)
  -- ==========================================================================
  INSERT INTO triggers (tenant_id, name, description, event_type, action_type, action_config, is_active, fired_count, created_by) VALUES
    (v_tenant_id, 'ต้อนรับ Lead ใหม่',
     'ส่ง LINE ต้อนรับทันทีเมื่อมี Lead ใหม่ลงทะเบียน + แนะนำโครงการ',
     'lead.created', 'send_line_message',
     '{"template": "welcome", "include_brochure": true}',
     true, 1247, v_user_id),

    (v_tenant_id, 'วันเกิดลูกค้า',
     'ส่งคำอวยพรวันเกิด + นัดดูบ้านพิเศษ',
     'customer.birthday', 'send_line_message',
     '{"template": "birthday", "schedule_visit_link": true}',
     true, 318, v_user_id),

    (v_tenant_id, 'ดูโครงการแล้ว 24 ชม. ไม่ติดต่อ',
     'ส่ง follow-up พร้อม floor plan + รายละเอียดเพิ่ม',
     'lead.viewed_property', 'send_line_message',
     '{"template": "viewed_followup", "delay_hours": 24}',
     true, 562, v_user_id),

    (v_tenant_id, 'Lead เงียบ 7 วัน',
     'ส่ง content marketing — testimonial + virtual tour',
     'lead.inactive_7d', 'send_line_message',
     '{"template": "reengage_7d", "include_testimonial": true}',
     true, 892, v_user_id),

    (v_tenant_id, 'Lead เงียบ 30 วัน',
     'Win-back — ส่งความคืบหน้าโครงการ + ราคาพิเศษ',
     'lead.inactive_30d', 'send_line_message',
     '{"template": "winback", "include_construction_update": true}',
     false, 1024, v_user_id),

    (v_tenant_id, 'ครบรอบลงทะเบียน 1 ปี',
     'ขอบคุณลูกค้า + ข่าวสารโครงการใหม่',
     'customer.anniversary', 'send_line_message',
     '{"template": "anniversary", "include_new_projects": true}',
     true, 156, v_user_id);

  -- ==========================================================================
  -- CAMPAIGNS — 10 real estate news/content campaigns
  -- ==========================================================================
  INSERT INTO campaigns (
    tenant_id, campaign_code, campaign_name, image_url, detail,
    start_date, end_date, frequency, segments, activities, status,
    recipients_count, impressions_count, clicks_count, ctr,
    headline, message_body, cta_text, cta_url, template,
    campaign_type, schedule_type, approval_status, created_by
  ) VALUES
    (v_tenant_id, 'CMP-001', 'เปิดโครงการใหม่ BAAN ISSARA Phase 2',
     'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=500&fit=crop&auto=format&q=70',
     'เปิดจองรอบ Pre-Sale BAAN ISSARA Phase 2 — ใกล้ BTS, พื้นที่ส่วนกลาง 5 ไร่',
     '2026-04-01', '2026-05-31', 'weekly',
     ARRAY['income_high', 'first_home']::TEXT[], ARRAY['new_lead', 'viewing_scheduled']::TEXT[],
     'active', 4820, 4820, 1658, 34.4,
     '🏠 เปิดจอง BAAN ISSARA Phase 2', 'Pre-Sale รอบพิเศษ — ส่วนลดสูงสุด 500,000 + ฟรีเฟอร์ครบชุด · จองก่อนใคร',
     'ดูโครงการ', 'https://chateau.app/p/baan-issara-2',
     'bubble', 'launch', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-002', 'นัดดูบ้านสุดสัปดาห์',
     'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=800&h=500&fit=crop&auto=format&q=70',
     'Open House สุดสัปดาห์นี้ ทุกโครงการ พร้อมที่ปรึกษาส่วนตัว',
     '2026-04-10', '2026-04-30', 'daily',
     ARRAY['income_medium', 'family']::TEXT[], ARRAY['contacted', 'negotiating']::TEXT[],
     'active', 3120, 3120, 723, 23.2,
     '📅 Open House — สุดสัปดาห์นี้', 'นัดดูบ้านได้ทุกโครงการ พร้อมที่ปรึกษาส่วนตัว · 25-26 เม.ย. 10:00-17:00',
     'นัดเลย', 'https://chateau.app/visit',
     'bubble', 'open_house', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-003', 'อัปเดตความคืบหน้าโครงการ Q2',
     'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=800&h=500&fit=crop&auto=format&q=70',
     'ความคืบหน้าโครงการต่างๆ Q2/2026 พร้อมรูปไซต์งาน',
     '2026-04-15', '2026-06-30', 'monthly',
     ARRAY['income_high', 'investment']::TEXT[], ARRAY['viewed', 'reserved']::TEXT[],
     'active', 2480, 2480, 459, 18.5,
     '🏗️ ความคืบหน้าโครงการ Q2', 'อัปเดตทุกโครงการ — ดูรูปไซต์งานล่าสุด พร้อมระยะเวลาส่งมอบ',
     'ดูรูปทั้งหมด', 'https://chateau.app/progress/q2-2026',
     'carousel', 'construction_update', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-004', 'Family Weekend — Open House บ้านเดี่ยว',
     'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&h=500&fit=crop&auto=format&q=70',
     'Open House บ้านเดี่ยวสุดสัปดาห์ พร้อมกิจกรรมสำหรับครอบครัว',
     '2026-04-20', '2026-05-15', 'weekly',
     ARRAY['family', 'age_middle']::TEXT[], ARRAY['new_lead', 'viewing_scheduled']::TEXT[],
     'active', 5280, 5280, 861, 16.3,
     '👨‍👩‍👧 Family Weekend Open House', 'นัดดูบ้านเดี่ยว + กิจกรรมครอบครัว เสาร์-อาทิตย์ 10:00-17:00',
     'นัดดู', 'https://chateau.app/visit/weekend',
     'bubble', 'open_house', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-005', 'VIP Exclusive — Penthouse Tour',
     'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=500&fit=crop&auto=format&q=70',
     'เชิญลูกค้า VIP ดู Penthouse ก่อนเปิดสาธารณะ 7 วัน',
     '2026-05-01', '2026-05-31', 'monthly',
     ARRAY['income_high', 'investment']::TEXT[], ARRAY['contacted', 'negotiating']::TEXT[],
     'paused', 168, 0, 0, 0,
     '👑 VIP Exclusive Penthouse', 'เชิญดู Penthouse ชั้นบนสุด ก่อนเปิดสาธารณะ 7 วัน · จองสล็อตวันที่คุณสะดวก',
     'จองสล็อต', 'https://chateau.app/vip/penthouse',
     'carousel', 'event', 'schedule', 'pending', v_user_id),

    (v_tenant_id, 'CMP-006', 'ห้องสุดท้ายโครงการ A',
     'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=500&fit=crop&auto=format&q=70',
     'เหลือ 12 ห้องสุดท้าย โครงการ A · จองภายใน 14 วัน',
     '2026-05-10', '2026-05-24', 'daily',
     ARRAY['income_medium', 'first_home']::TEXT[], ARRAY['viewed', 'inactive']::TEXT[],
     'paused', 1840, 0, 0, 0,
     '🔥 เหลือ 12 ห้องสุดท้าย', 'โครงการ A ใกล้ปิดการขาย — เลือกชั้นและวิวที่ต้องการก่อนใคร',
     'ดูห้องที่เหลือ', 'https://chateau.app/clearance',
     'image', 'sales', 'schedule', 'pending', v_user_id),

    (v_tenant_id, 'CMP-007', 'งานเปิดตัวโครงการสงกรานต์ 2569',
     'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&h=500&fit=crop&auto=format&q=70',
     'งานเปิดตัวโครงการช่วงสงกรานต์ + กิจกรรมครอบครัว',
     '2026-04-12', '2026-04-16', 'daily',
     ARRAY['family', 'age_young']::TEXT[], ARRAY['new_lead']::TEXT[],
     'completed', 7250, 7250, 711, 9.8,
     '🎉 งานเปิดตัวสงกรานต์ 2569', 'Pre-launch event — เล่นน้ำสงกรานต์ + ดูโครงการ + ของรางวัล',
     'ลงทะเบียน', 'https://chateau.app/event/songkran-2026',
     'bubble', 'event', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-008', 'ข่าวสารวงการอสังหา เม.ย. 2569',
     'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&h=500&fit=crop&auto=format&q=70',
     'Newsletter สรุปข่าวสารอสังหาประจำเดือน + แนวโน้มตลาด',
     '2026-04-25', '2026-05-25', 'weekly',
     ARRAY['income_medium', 'first_home', 'family']::TEXT[], ARRAY['negotiating', 'reserved']::TEXT[],
     'active', 3640, 3640, 364, 10.0,
     '📰 ข่าวสารวงการอสังหา', 'สรุปข่าวสารและแนวโน้มตลาด + ราคาประเมินทำเลฮอต',
     'อ่านต่อ', 'https://chateau.app/newsletter/2026-04',
     'bubble', 'newsletter', 'now', 'approved', v_user_id),

    (v_tenant_id, 'CMP-009', 'Re-engage Lead เงียบ 30 วัน',
     'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800&h=500&fit=crop&auto=format&q=70',
     'Win-back content สำหรับ leads ที่ไม่มีกิจกรรม 30 วัน',
     '2026-05-15', '2026-06-15', 'biweekly',
     ARRAY['income_low']::TEXT[], ARRAY['inactive', 'lost']::TEXT[],
     'draft', 920, 0, 0, 0,
     '💌 เรายังคิดถึงคุณ', 'อัปเดตข่าวสารโครงการล่าสุด + รับที่ปรึกษาส่วนตัว',
     'ดูข่าวสาร', 'https://chateau.app/winback',
     'bubble', 'news', 'schedule', 'pending', v_user_id),

    (v_tenant_id, 'CMP-010', 'Welcome Pack สมาชิกใหม่',
     'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&h=500&fit=crop&auto=format&q=70',
     'ต้อนรับสมาชิกใหม่ + แนะนำโครงการที่เหมาะกับคุณ',
     '2026-04-01', '2026-12-31', 'daily',
     ARRAY['age_young', 'first_home']::TEXT[], ARRAY['new_lead']::TEXT[],
     'active', 12480, 12480, 811, 6.5,
     '🎁 ยินดีต้อนรับ', 'รับ checklist เลือกโครงการ + นัดดูบ้านฟรี + ที่ปรึกษาส่วนตัว',
     'เริ่มต้น', 'https://chateau.app/welcome',
     'bubble', 'newsletter', 'now', 'approved', v_user_id)
  ON CONFLICT (tenant_id, campaign_code) DO NOTHING;

END $$;
