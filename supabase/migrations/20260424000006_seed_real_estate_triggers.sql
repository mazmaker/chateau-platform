-- Add real-estate-specific triggers (viewing / booking / project events)
-- Adds detailed message templates in action_config for preview

DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID;
BEGIN
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at LIMIT 1;
  IF v_tenant_id IS NULL THEN RAISE NOTICE 'No tenants found. Skipping.'; RETURN; END IF;

  SELECT id INTO v_user_id FROM users WHERE tenant_id = v_tenant_id ORDER BY created_at LIMIT 1;

  -- ============================================================================
  -- Viewing / นัดดูบ้าน (3 triggers)
  -- ============================================================================
  INSERT INTO triggers (tenant_id, name, description, event_type, action_type, action_config, is_active, fired_count, created_by) VALUES
    (v_tenant_id, 'ยืนยันนัดดูบ้าน',
     'ส่ง confirmation + แผนที่ + วันเวลา ทันทีหลังลูกค้านัดดูบ้าน',
     'viewing.scheduled', 'send_line_message',
     '{"message_template": "🗓️ ยืนยันนัดดูบ้านสำเร็จ!\n\nสวัสดีคุณ {{first_name}}\nคุณได้นัดดู {{property_name}} ในวันที่ {{viewing_date}} เวลา {{viewing_time}}\n\n📍 พิกัด: {{property_location}}\nเจ้าหน้าที่ดูแล: {{sales_name}} ({{sales_phone}})\n\nหากต้องการเปลี่ยนนัด กดที่ปุ่มด้านล่าง", "cta_text": "เปลี่ยนวันนัด", "include_map": true}',
     true, 234, v_user_id),

    (v_tenant_id, 'เตือนก่อนวันนัด 1 วัน',
     'แจ้งเตือนล่วงหน้า 1 วันก่อนนัดดูบ้าน + ยืนยันมาตามนัด',
     'viewing.tomorrow_reminder', 'send_line_message',
     '{"message_template": "⏰ พรุ่งนี้พบกัน!\n\nคุณ {{first_name}} ครับ พรุ่งนี้ ({{viewing_date}}) เวลา {{viewing_time}}\nเรานัดดูโครงการ {{property_name}} ครับ\n\nกรุณายืนยันการมาตามนัดได้ที่ปุ่มด้านล่าง", "cta_text": "ยืนยันมาตามนัด", "send_hours_before": 24}',
     true, 178, v_user_id),

    (v_tenant_id, 'No-show — re-engage',
     'ส่ง LINE หาลูกค้าที่ไม่มาตามนัด เพื่อขอ reschedule',
     'viewing.no_show', 'send_line_message',
     '{"message_template": "เสียดายที่พลาดนัด!\n\nคุณ {{first_name}} เราเห็นว่าวันนี้คุณไม่ได้มาตามนัดที่ {{property_name}}\n\nไม่เป็นไรครับ — เลือกเวลาใหม่ที่สะดวกได้ที่ลิงก์ด้านล่าง เรามียูนิตให้เลือกชมเพิ่มเติมด้วย", "cta_text": "นัดใหม่", "delay_minutes": 60}',
     false, 42, v_user_id),

  -- ============================================================================
  -- Booking / Sales Pipeline (3 triggers)
  -- ============================================================================
    (v_tenant_id, 'จองสำเร็จ — ขอบคุณ',
     'ส่งข้อความขอบคุณ + รายการเอกสารที่ต้องเตรียม หลังจ่ายเงินจอง',
     'booking.deposit_paid', 'send_line_message',
     '{"message_template": "🎉 ขอบคุณที่เลือก {{property_name}}!\n\nคุณ {{first_name}} ได้จองยูนิต {{unit_number}} เรียบร้อย\nยอดจอง: ฿{{deposit_amount}}\n\nเอกสารที่ต้องเตรียมภายใน 7 วัน:\n• สำเนาบัตรประชาชน\n• สลิปเงินเดือน 3 เดือน\n• Statement บัญชี 6 เดือน\n• เอกสารเครดิตบูโร\n\nเจ้าหน้าที่: {{sales_name}}", "cta_text": "ดูรายละเอียดการจอง"}',
     true, 89, v_user_id),

    (v_tenant_id, 'แจ้งเตือนชำระเงินดาวน์',
     'reminder ก่อนถึงกำหนดชำระเงินดาวน์ 3 วัน',
     'booking.payment_due_3d', 'send_line_message',
     '{"message_template": "💰 แจ้งเตือนชำระเงินดาวน์\n\nคุณ {{first_name}} ครับ\nกำหนดชำระเงินดาวน์งวดถัดไปอีก 3 วัน ({{due_date}})\n\nยอดที่ต้องชำระ: ฿{{amount_due}}\nธนาคาร: {{bank_account}}\n\nหากชำระแล้วกรุณาแจ้งเลขที่อ้างอิงทางช่องทางนี้ครับ", "cta_text": "ดูใบแจ้งหนี้", "days_before_due": 3}',
     true, 156, v_user_id),

    (v_tenant_id, 'เซ็นสัญญาแล้ว — Welcome',
     'ส่ง welcome to ownership หลังเซ็นสัญญาซื้อขาย',
     'booking.contract_signed', 'send_line_message',
     '{"message_template": "🏠 ยินดีต้อนรับสู่ครอบครัว {{tenant_name}}!\n\nคุณ {{first_name}} ได้เซ็นสัญญา {{property_name}} ยูนิต {{unit_number}} เรียบร้อย\n\nขั้นตอนถัดไป:\n1. ติดตามความคืบหน้าโครงการ\n2. นัดวันโอน (ประมาณ {{handover_date}})\n3. ชำระเงินงวดสุดท้าย\n\nขอบคุณที่เลือกเรา ❤️", "cta_text": "ดูตารางการก่อสร้าง"}',
     true, 47, v_user_id),

  -- ============================================================================
  -- Project Updates (2 triggers — สำหรับลูกค้าเก่า/ลูกค้าจองแล้ว)
  -- ============================================================================
    (v_tenant_id, 'ความคืบหน้าโครงการรายเดือน',
     'ส่งภาพ + วีดีโอความคืบหน้าให้ลูกค้าที่จองแล้ว',
     'project.construction_milestone', 'send_line_message',
     '{"message_template": "📸 อัปเดตความคืบหน้า {{property_name}}\n\nคุณ {{first_name}}\nเดือน {{current_month}} ความคืบหน้า {{progress_percent}}%\n\n🔨 งานที่ทำเสร็จเดือนนี้:\n{{milestone_summary}}\n\nคาดว่าจะส่งมอบได้ตามแผน ({{handover_date}})", "cta_text": "ดูภาพ + วีดีโอ", "frequency": "monthly"}',
     true, 312, v_user_id),

    (v_tenant_id, 'แจ้ง Lead เมื่อราคาลด',
     'แจ้ง leads ที่เคยสนใจโครงการเมื่อมีโปรโมชั่นใหม่',
     'unit.price_dropped', 'send_line_message',
     '{"message_template": "🔥 ราคาพิเศษเฉพาะคุณ!\n\nคุณ {{first_name}} ครับ\n{{property_name}} ที่คุณเคยสนใจ ตอนนี้ลดราคาพิเศษ\n\nจาก ฿{{original_price}} → ฿{{new_price}}\nประหยัด ฿{{savings}}\n\n⏰ โปรโมชั่นถึง {{promo_end_date}} เท่านั้น", "cta_text": "ดูยูนิตที่เหลือ", "min_price_drop_percent": 5}',
     true, 425, v_user_id),

  -- ============================================================================
  -- Inventory Urgency (1 trigger)
  -- ============================================================================
    (v_tenant_id, 'ยูนิตเหลือ 3 ห้องสุดท้าย',
     'แจ้ง leads ที่ทำการ inquiry กับโครงการที่ใกล้ขายหมด',
     'unit.last_3_remaining', 'send_line_message',
     '{"message_template": "⚠️ เหลือเพียง 3 ยูนิต!\n\nคุณ {{first_name}} ครับ\n{{property_name}} ที่คุณดูเมื่อ {{last_viewed}} ตอนนี้เหลือเพียง 3 ห้องสุดท้าย\n\nยูนิตที่เหลือ:\n{{remaining_units_list}}\n\nรีบจองด่วน ก่อนหมด!", "cta_text": "จองยูนิตด่วน", "trigger_threshold": 3}',
     true, 67, v_user_id);

  RAISE NOTICE 'Seeded 9 real-estate triggers (3 viewing + 3 booking + 2 project + 1 inventory)';
END $$;
