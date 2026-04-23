-- Create error_logs table for tracking system errors from all users
CREATE TABLE IF NOT EXISTS public.error_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  error_level TEXT NOT NULL CHECK (error_level IN ('error', 'warning', 'info')),
  error_message TEXT NOT NULL,
  error_stack TEXT,
  component_name TEXT,
  user_agent TEXT,
  page_url TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_id ON public.error_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_level ON public.error_logs(error_level);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolved ON public.error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON public.error_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_tenant_created ON public.error_logs(tenant_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Only Owners can view all error logs
CREATE POLICY "Owners can view all error logs"
  ON public.error_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'owner'
    )
  );

CREATE POLICY "System can insert error logs"
  ON public.error_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Owners can update error logs"
  ON public.error_logs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'owner'
    )
  );

-- Function to log error
CREATE OR REPLACE FUNCTION public.log_error(
  p_tenant_id UUID,
  p_user_id UUID,
  p_error_level TEXT,
  p_error_message TEXT,
  p_error_stack TEXT DEFAULT NULL,
  p_component_name TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_page_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.error_logs (
    tenant_id,
    user_id,
    error_level,
    error_message,
    error_stack,
    component_name,
    user_agent,
    page_url,
    metadata
  ) VALUES (
    p_tenant_id,
    p_user_id,
    p_error_level,
    p_error_message,
    p_error_stack,
    p_component_name,
    p_user_agent,
    p_page_url,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Grant access to authenticated users
GRANT SELECT ON public.error_logs TO authenticated;
GRANT INSERT ON public.error_logs TO authenticated;
GRANT UPDATE ON public.error_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_error TO authenticated;

-- Function to get error logs with tenant and user names (for owner dashboard)
CREATE OR REPLACE FUNCTION public.get_recent_errors(
  limit_count INT DEFAULT 20,
  include_resolved BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  tenant_name TEXT,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  error_level TEXT,
  error_message TEXT,
  component_name TEXT,
  page_url TEXT,
  resolved BOOLEAN,
  created_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    el.id,
    el.tenant_id,
    t.name AS tenant_name,
    el.user_id,
    u.full_name AS user_name,
    u.email AS user_email,
    el.error_level,
    el.error_message,
    el.component_name,
    el.page_url,
    el.resolved,
    el.created_at
  FROM public.error_logs el
  LEFT JOIN public.tenants t ON el.tenant_id = t.id
  LEFT JOIN public.users u ON el.user_id = u.id
  WHERE
    include_resolved = true OR el.resolved = false
  ORDER BY el.created_at DESC
  LIMIT limit_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_recent_errors TO authenticated;

-- Function to mark error as resolved
CREATE OR REPLACE FUNCTION public.resolve_error(
  p_error_id UUID,
  p_resolved_by UUID
) RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.error_logs
  SET
    resolved = TRUE,
    resolved_at = NOW(),
    resolved_by = p_resolved_by
  WHERE id = p_error_id;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_error TO authenticated;

-- Function to get error statistics
CREATE OR REPLACE FUNCTION public.get_error_stats()
RETURNS TABLE (
  total_errors BIGINT,
  unresolved_errors BIGINT,
  error_count BIGINT,
  warning_count BIGINT,
  info_count BIGINT,
  errors_today BIGINT,
  errors_this_week BIGINT
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.error_logs),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE resolved = false),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE error_level = 'error'),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE error_level = 'warning'),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE error_level = 'info'),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE created_at >= CURRENT_DATE),
    (SELECT COUNT(*)::BIGINT FROM public.error_logs WHERE created_at >= CURRENT_DATE - INTERVAL '7 days');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_error_stats TO authenticated;
