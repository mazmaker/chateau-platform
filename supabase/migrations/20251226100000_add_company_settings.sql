-- ============================================================================
-- CHATEAU Platform: Company Settings Table
-- ============================================================================
-- Stores company branding: logo, colors, company name
-- Each tenant has one company_settings record
-- ============================================================================

-- Create company_settings table (skip if exists)
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  logo_url TEXT,
  logo_storage_path TEXT,
  company_name TEXT,
  primary_color TEXT DEFAULT '#7c3aed',
  secondary_color TEXT DEFAULT '#38B6FFCC',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(tenant_id)
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tenant members can view company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only Owner and Admin can insert company settings" ON public.company_settings;
DROP POLICY IF EXISTS "Only Owner and Admin can update company settings" ON public.company_settings;

-- RLS Policies: Tenant members can view, only Owner/Admin can manage

-- All users in the tenant can view company settings
CREATE POLICY "Tenant members can view company settings"
  ON public.company_settings FOR SELECT
  USING (tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Only Owner and Admin can insert company settings
CREATE POLICY "Only Owner and Admin can insert company settings"
  ON public.company_settings FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Only Owner and Admin can update company settings
CREATE POLICY "Only Owner and Admin can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_company_settings_tenant_id ON public.company_settings(tenant_id);

-- ============================================================================
-- Function: Get or Create Default Company Settings
-- ============================================================================
-- Returns company settings for a tenant, creates default if not exists
-- ============================================================================

DROP FUNCTION IF EXISTS get_or_create_company_settings(p_tenant_id UUID);

CREATE FUNCTION get_or_create_company_settings(p_tenant_id UUID)
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
GRANT EXECUTE ON FUNCTION get_or_create_company_settings(UUID) TO authenticated;
