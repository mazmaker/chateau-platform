-- Create lead_interests table for tracking multiple unit interests per lead
CREATE TABLE IF NOT EXISTS lead_interests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,

    -- Status tracking per unit
    status VARCHAR(20) DEFAULT 'interested'
        CHECK (status IN ('interested', 'viewing_scheduled', 'viewed', 'negotiating', 'reserved', 'won', 'lost', 'dropped')),
    interest_level VARCHAR(10) DEFAULT 'medium'
        CHECK (interest_level IN ('high', 'medium', 'low')),

    -- Details
    notes TEXT,
    viewing_date TIMESTAMP WITH TIME ZONE,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Prevent duplicate lead-unit pairs
    UNIQUE(lead_id, unit_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_lead_interests_tenant_id ON lead_interests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_lead_interests_lead_id ON lead_interests(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_interests_property_id ON lead_interests(property_id);
CREATE INDEX IF NOT EXISTS idx_lead_interests_unit_id ON lead_interests(unit_id);
CREATE INDEX IF NOT EXISTS idx_lead_interests_status ON lead_interests(status);

-- Enable RLS
ALTER TABLE lead_interests ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_interests table
DROP POLICY IF EXISTS "Service role has full access to lead_interests" ON lead_interests;
CREATE POLICY "Service role has full access to lead_interests" ON lead_interests
    FOR ALL USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Users view tenant lead_interests" ON lead_interests;
CREATE POLICY "Users view tenant lead_interests" ON lead_interests
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users insert tenant lead_interests" ON lead_interests;
CREATE POLICY "Users insert tenant lead_interests" ON lead_interests
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users update tenant lead_interests" ON lead_interests;
CREATE POLICY "Users update tenant lead_interests" ON lead_interests
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users delete tenant lead_interests" ON lead_interests;
CREATE POLICY "Users delete tenant lead_interests" ON lead_interests
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Migrate existing lead unit_id data to lead_interests (if any)
INSERT INTO lead_interests (tenant_id, lead_id, property_id, unit_id, status, interest_level)
SELECT
    l.tenant_id,
    l.id as lead_id,
    l.property_id,
    l.unit_id,
    'interested' as status,
    'medium' as interest_level
FROM leads l
WHERE l.unit_id IS NOT NULL
    AND l.property_id IS NOT NULL
ON CONFLICT (lead_id, unit_id) DO NOTHING;
