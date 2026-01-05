-- Create storage bucket for campaign images

-- Insert storage bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaigns',
  'campaigns',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Create policy for public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Public read access for campaigns bucket'
  ) THEN
    CREATE POLICY "Public read access for campaigns bucket"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'campaigns');
  END IF;
END $$;

-- Create policy for authenticated users to upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Authenticated users can upload to campaigns bucket'
  ) THEN
    CREATE POLICY "Authenticated users can upload to campaigns bucket"
    ON storage.objects FOR INSERT
    WITH CHECK (
      bucket_id = 'campaigns'
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Create policy for authenticated users to update their files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Authenticated users can update their files in campaigns bucket'
  ) THEN
    CREATE POLICY "Authenticated users can update their files in campaigns bucket"
    ON storage.objects FOR UPDATE
    USING (
      bucket_id = 'campaigns'
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;

-- Create policy for authenticated users to delete their files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Authenticated users can delete their files in campaigns bucket'
  ) THEN
    CREATE POLICY "Authenticated users can delete their files in campaigns bucket"
    ON storage.objects FOR DELETE
    USING (
      bucket_id = 'campaigns'
      AND auth.role() = 'authenticated'
    );
  END IF;
END $$;
