-- Create campaigns table for LINE promotion campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_code VARCHAR(50) NOT NULL,
  campaign_name VARCHAR(255) NOT NULL,
  campaign_url TEXT,
  image_url TEXT,
  detail TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  frequency VARCHAR(50) DEFAULT 'daily', -- daily, weekly, biweekly, triweekly, monthly
  segments TEXT[] DEFAULT '{}', -- Array of segment names
  activities TEXT[] DEFAULT '{}', -- Array of activity names
  status VARCHAR(20) DEFAULT 'draft', -- draft, active, paused, completed
  -- Statistics (will be updated by tracking system)
  recipients_count INTEGER DEFAULT 0,
  impressions_count INTEGER DEFAULT 0,
  clicks_count INTEGER DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0.00, -- Click Through Rate percentage
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, campaign_code)
);

-- Create index for better query performance
CREATE INDEX idx_campaigns_tenant_id ON campaigns(tenant_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_start_date ON campaigns(start_date);
CREATE INDEX idx_campaigns_end_date ON campaigns(end_date);

-- Enable RLS
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view campaigns in their tenant"
  ON campaigns FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can insert campaigns in their tenant"
  ON campaigns FOR INSERT
  WITH CHECK (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can update campaigns in their tenant"
  ON campaigns FOR UPDATE
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

CREATE POLICY "Users can delete campaigns in their tenant"
  ON campaigns FOR DELETE
  USING (tenant_id IN (
    SELECT tenant_id FROM users WHERE id = auth.uid()
  ));

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();

-- Insert sample campaigns for demo
-- Note: This will only work if tenants and users exist
-- INSERT INTO campaigns (tenant_id, campaign_code, campaign_name, campaign_url, detail, start_date, end_date, frequency, segments, activities, status, recipients_count, impressions_count, clicks_count, ctr)
-- SELECT
--   t.id,
--   'C2024031604006',
--   'คุ้มสุดๆ',
--   'https://example.com/campaign/1',
--   'โปรโมชันพิเศษสำหรับลูกค้าใหม่',
--   '2024-03-24',
--   '2024-03-30',
--   'daily',
--   ARRAY['ประเภทโครงการ', 'จำนวนผู้อยู่ในโครงการ'],
--   ARRAY['เข้าพบแล้ว', 'แผนเลือกห้องอัตโนมัติ'],
--   'active',
--   1000,
--   5000,
--   925,
--   18.50
-- FROM tenants t
-- LIMIT 1;
