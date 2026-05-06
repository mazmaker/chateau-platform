-- Marketing Module Tables — Segments, Triggers, + extend Campaigns
-- Scope: Content/News distribution สำหรับ real estate (ไม่ใช้ voucher)
-- Creates the missing tables that the new Marketing UI depends on

-- ============================================================================
-- 1. SEGMENTS — Customer segments for campaign targeting
-- ============================================================================
CREATE TABLE IF NOT EXISTS segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  filter_rules JSONB DEFAULT '{}',   -- { income_min: 100000, age_range: [25, 45], ... }
  member_count INTEGER DEFAULT 0,    -- cached count, refreshed by segment_members table
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, code)
);

CREATE INDEX IF NOT EXISTS idx_segments_tenant_id ON segments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_segments_is_active ON segments(is_active);

ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_segments" ON segments FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_segments" ON segments FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_segments" ON segments FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_segments" ON segments FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- 2. TRIGGERS — Marketing automation rules (event-driven)
-- ============================================================================
CREATE TABLE IF NOT EXISTS triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(100) NOT NULL,      -- lead.created, customer.birthday, lead.viewed_property, lead.inactive_7d, etc.
  action_type VARCHAR(100) NOT NULL,     -- send_line_message, send_email, assign_to_sales, create_task
  action_config JSONB DEFAULT '{}',      -- { template_id, property_id, delay_minutes, ... }
  conditions JSONB DEFAULT '{}',         -- { min_value: 1000, segments: ['vip'], ... }
  is_active BOOLEAN DEFAULT true,
  fired_count INTEGER DEFAULT 0,
  last_fired_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_triggers_tenant_id ON triggers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_triggers_event_type ON triggers(event_type);
CREATE INDEX IF NOT EXISTS idx_triggers_is_active ON triggers(is_active);

ALTER TABLE triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_select_triggers" ON triggers FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_insert_triggers" ON triggers FOR INSERT
  WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_update_triggers" ON triggers FOR UPDATE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));
CREATE POLICY "tenant_delete_triggers" ON triggers FOR DELETE
  USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- ============================================================================
-- 3. EXTEND CAMPAIGNS — add fields for content distribution + property linkage
-- ============================================================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_type VARCHAR(50) DEFAULT 'newsletter',  -- launch, open_house, construction_update, sales, event, newsletter
  ADD COLUMN IF NOT EXISTS cta_text VARCHAR(100),
  ADD COLUMN IF NOT EXISTS cta_url TEXT,
  ADD COLUMN IF NOT EXISTS template VARCHAR(50) DEFAULT 'bubble',  -- carousel, bubble, image, buttons
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS message_body TEXT,
  ADD COLUMN IF NOT EXISTS attachment_urls JSONB DEFAULT '[]',     -- [{type:'image', url:'...'}, {type:'pdf', url:'brochure'}]
  ADD COLUMN IF NOT EXISTS schedule_type VARCHAR(20) DEFAULT 'now',  -- now, schedule, recurring
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
  ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS utm_params JSONB DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_campaigns_property_id ON campaigns(property_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_campaign_type ON campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_campaigns_approval_status ON campaigns(approval_status);

-- ============================================================================
-- 4. updated_at triggers (auto-update timestamp on UPDATE)
-- ============================================================================
CREATE OR REPLACE FUNCTION update_marketing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS segments_updated_at ON segments;
CREATE TRIGGER segments_updated_at BEFORE UPDATE ON segments
  FOR EACH ROW EXECUTE FUNCTION update_marketing_updated_at();

DROP TRIGGER IF EXISTS triggers_updated_at ON triggers;
CREATE TRIGGER triggers_updated_at BEFORE UPDATE ON triggers
  FOR EACH ROW EXECUTE FUNCTION update_marketing_updated_at();
