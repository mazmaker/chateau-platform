// Script to create leads table
// This will output the SQL that needs to be run in Supabase Dashboard > SQL Editor

const sql = `
-- Create leads table for tracking potential customers
CREATE TABLE IF NOT EXISTS leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
    property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'negotiating', 'won', 'lost')),
    source VARCHAR(255),
    assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    estimated_value DECIMAL(15,2),
    expected_close_date DATE,
    last_contact_date TIMESTAMP WITH TIME ZONE,
    next_follow_up DATE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_leads_tenant_id ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_customer_id ON leads(customer_id);
CREATE INDEX IF NOT EXISTS idx_leads_property_id ON leads(property_id);
CREATE INDEX IF NOT EXISTS idx_leads_unit_id ON leads(unit_id);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at DESC);

-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- RLS policies for tenant isolation
CREATE POLICY "Users can view leads in their tenant" ON leads
    FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert leads in their tenant" ON leads
    FOR INSERT WITH CHECK (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update leads in their tenant" ON leads
    FOR UPDATE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete leads in their tenant" ON leads
    FOR DELETE USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Allow service role full access (for API operations)
CREATE POLICY "Service role has full access to leads" ON leads
    FOR ALL USING (auth.role() = 'service_role');

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_leads_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS leads_updated_at ON leads;
CREATE TRIGGER leads_updated_at
    BEFORE UPDATE ON leads
    FOR EACH ROW
    EXECUTE FUNCTION update_leads_updated_at();

SELECT 'Leads table created successfully!' as status;
`;

console.log('📋 Please copy and run the following SQL in Supabase Dashboard > SQL Editor:');
console.log('================================================================================');
console.log(sql);
console.log('================================================================================');
console.log('\\n✅ After running the SQL, the leads table will be ready to use.');
