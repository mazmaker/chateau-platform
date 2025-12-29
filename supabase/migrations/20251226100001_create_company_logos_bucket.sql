-- ============================================================================
-- CHATEAU Platform: Company Logos Storage Bucket
-- ============================================================================
-- Public storage bucket for company logo images
-- Path format: {tenant_id}/{timestamp}.{ext}
-- File restrictions: PNG, JPG only | Max 500KB | Recommended 400x400px
-- ============================================================================

-- Create storage bucket for company logos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'company-logos',
  'company-logos',
  true,
  512000, -- 500KB limit (512 * 1000)
  ARRAY['image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 512000,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg'];

-- ============================================================================
-- Storage RLS Policies
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Only Owner and Admin can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view logos" ON storage.objects;
DROP POLICY IF EXISTS "Only Owner and Admin can delete logos" ON storage.objects;
DROP POLICY IF EXISTS "Only Owner and Admin can update logos" ON storage.objects;

-- Allow authenticated users to upload logos (only Owner and Admin per tenant)
CREATE POLICY "Only Owner and Admin can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-logos'
    AND (
      -- Extract tenant_id from path (format: tenant_id/filename)
      EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin')
        AND tenant_id = (split_part(name, '/', 1))::uuid
      )
    )
  );

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Anyone can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'company-logos');

-- Allow Owner and Admin to delete their tenant's logos
CREATE POLICY "Only Owner and Admin can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
      AND tenant_id = (split_part(name, '/', 1))::uuid
    )
  );

-- Allow Owner and Admin to update their tenant's logos
CREATE POLICY "Only Owner and Admin can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
      AND tenant_id = (split_part(name, '/', 1))::uuid
    )
  )
  WITH CHECK (
    bucket_id = 'company-logos'
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('owner', 'admin')
      AND tenant_id = (split_part(name, '/', 1))::uuid
    )
  );
