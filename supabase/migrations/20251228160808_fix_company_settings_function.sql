-- ============================================================================
-- Fix: Get or Create Company Settings Function
-- ============================================================================
-- Fixes ambiguous column reference and uses proper PL/pgSQL syntax
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_or_create_company_settings(p_tenant_id UUID);

CREATE FUNCTION public.get_or_create_company_settings(p_tenant_id UUID)
RETURNS TABLE (
  setting_id UUID,
  tenant_id UUID,
  logo_url TEXT,
  logo_storage_path TEXT,
  company_name TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_settings RECORD;
BEGIN
  -- Try to get existing settings
  SELECT * INTO v_settings
  FROM public.company_settings
  WHERE tenant_id = p_tenant_id
  LIMIT 1;

  -- If not found, create new
  IF NOT FOUND THEN
    INSERT INTO public.company_settings (tenant_id, company_name)
    SELECT p_tenant_id, name
    FROM public.tenants
    WHERE id = p_tenant_id
    RETURNING * INTO v_settings;
  END IF;

  RETURN QUERY
  SELECT
    v_settings.id AS setting_id,
    v_settings.tenant_id,
    v_settings.logo_url,
    v_settings.logo_storage_path,
    v_settings.company_name,
    v_settings.primary_color,
    v_settings.secondary_color,
    v_settings.created_at,
    v_settings.updated_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_or_create_company_settings(UUID) TO authenticated;
