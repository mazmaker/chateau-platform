-- Create storage bucket for project files

-- Insert storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'projects',
  'projects',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
ON CONFLICT (id) DO NOTHING;

-- Drop policies if they exist (for safe re-run)
DROP POLICY IF EXISTS "Public read access for projects bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to projects bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update their files in projects bucket" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their files in projects bucket" ON storage.objects;

-- Create policy for public read access
CREATE POLICY "Public read access for projects bucket"
ON storage.objects FOR SELECT
USING (bucket_id = 'projects');

-- Create policy for authenticated users to upload
CREATE POLICY "Authenticated users can upload to projects bucket"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'projects'
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to update their files
CREATE POLICY "Authenticated users can update their files in projects bucket"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'projects'
  AND auth.role() = 'authenticated'
);

-- Create policy for authenticated users to delete their files
CREATE POLICY "Authenticated users can delete their files in projects bucket"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'projects'
  AND auth.role() = 'authenticated'
);
