-- Owner Leads contact history + follow-up date + tenant owner notes.
-- Applied to remote via MCP on 2026-06-19; this file mirrors that for version control.

-- #3 Contact history for platform leads
CREATE TABLE IF NOT EXISTS platform_lead_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES platform_leads(id) ON DELETE CASCADE,
  contact_type text NOT NULL DEFAULT 'note',   -- note / call / line / meeting
  body text NOT NULL,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE platform_lead_activities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owner_all" ON platform_lead_activities;
CREATE POLICY "owner_all" ON platform_lead_activities FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'))
  WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'owner'));

-- #4 Follow-up date on a lead
ALTER TABLE platform_leads ADD COLUMN IF NOT EXISTS follow_up_date date;

-- #1 Owner quick note on a tenant
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_notes text;
