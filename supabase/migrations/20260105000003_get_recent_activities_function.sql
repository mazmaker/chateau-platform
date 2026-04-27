-- Create get_recent_activities function for Owner Dashboard
-- Returns activities with tenant names for display

-- Drop existing function if it exists with different signature
DROP FUNCTION IF EXISTS get_recent_activities(INTEGER);

CREATE OR REPLACE FUNCTION get_recent_activities(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  activity_type TEXT,
  description TEXT,
  tenant_name TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.activity_type,
    al.description,
    t.name AS tenant_name,
    al.created_at
  FROM activity_logs al
  LEFT JOIN tenants t ON al.tenant_id = t.id
  ORDER BY al.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_recent_activities TO authenticated;

-- Enable RLS on activity_logs (if not already enabled)
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop policies first if they exist (ignore errors)
DROP POLICY IF EXISTS "Allow authenticated to read activity_logs" ON activity_logs;
DROP POLICY IF EXISTS "Allow authenticated to insert activity_logs" ON activity_logs;

-- Create policy for activity_logs
-- Users can see all activities for now (owner dashboard needs this)
CREATE POLICY "Allow authenticated to read activity_logs"
ON activity_logs FOR SELECT
TO authenticated
USING (true);

-- Create policy for inserting activity logs
CREATE POLICY "Allow authenticated to insert activity_logs"
ON activity_logs FOR INSERT
TO authenticated
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON activity_logs(tenant_id);
