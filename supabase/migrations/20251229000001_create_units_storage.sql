-- Create storage bucket for unit images

-- Insert storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'units',
  'units',
  true,
  10485760, -- 10MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
CREATE POLICY "Public read access for units bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'units');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload to units bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'units'
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to update their files
CREATE POLICY "Authenticated users can update files in units bucket"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'units'
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete their files
CREATE POLICY "Authenticated users can delete files in units bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'units'
  AND auth.role() = 'authenticated'
);
