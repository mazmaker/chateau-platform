-- Create activity_logs table for tracking system activities
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('user_added', 'tenant_created', 'subscription_renewed', 'plan_upgraded', 'user_updated', 'user_deleted', 'tenant_updated', 'tenant_suspended', 'tenant_activated')),
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_id ON public.activity_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity_type ON public.activity_logs(activity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_tenant_created ON public.activity_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Owners can see all logs, others can only see their tenant's logs
CREATE POLICY "Owners can view all activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'owner'
    )
  );

CREATE POLICY "Admins can view their tenant's activity logs"
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users
      WHERE users.id = auth.uid()
    )
  );

CREATE POLICY "System can insert activity logs"
  ON public.activity_logs
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Function to log activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_tenant_id UUID,
  p_user_id UUID,
  p_activity_type TEXT,
  p_description TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.activity_logs (tenant_id, user_id, activity_type, description, metadata)
  VALUES (p_tenant_id, p_user_id, p_activity_type, p_description, p_metadata)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant access to authenticated users
GRANT SELECT ON public.activity_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_activity TO service_role;

-- Drop existing function if signature is different
DROP FUNCTION IF EXISTS public.get_recent_activities(INT);

-- Function to get activity logs with tenant names (for owner dashboard)
CREATE OR REPLACE FUNCTION public.get_recent_activities(limit_count INT DEFAULT 10)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  user_id UUID,
  user_name TEXT,
  activity_type TEXT,
  description TEXT,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id,
    al.tenant_id,
    t.name AS tenant_name,
    al.user_id,
    u.full_name AS user_name,
    al.activity_type,
    al.description,
    al.created_at
  FROM public.activity_logs al
  LEFT JOIN public.tenants t ON al.tenant_id = t.id
  LEFT JOIN public.users u ON al.user_id = u.id
  ORDER BY al.created_at DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_activities TO authenticated;
