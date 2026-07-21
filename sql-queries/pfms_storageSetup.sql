-- =========================================================================
-- PFMS SUPABASE STORAGE BUCKET SETUP FOR COMPANY SUPABASE
-- Bucket name: 'pfms-purchase-fms'
-- =========================================================================

-- 1. Create a public storage bucket named 'pfms-purchase-fms'
INSERT INTO storage.buckets (id, name, public)
VALUES ('pfms-purchase-fms', 'pfms-purchase-fms', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow public read access to all files inside the 'pfms-purchase-fms' bucket
CREATE POLICY "Allow public read access to pfms-purchase-fms"
ON storage.objects FOR SELECT
USING (bucket_id = 'pfms-purchase-fms');

-- 3. Allow uploads (INSERT) to the 'pfms-purchase-fms' bucket
CREATE POLICY "Allow uploads to pfms-purchase-fms bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'pfms-purchase-fms');

-- 4. Allow updates and deletes to the 'pfms-purchase-fms' bucket
CREATE POLICY "Allow updates to pfms-purchase-fms bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'pfms-purchase-fms');

CREATE POLICY "Allow deletes to pfms-purchase-fms bucket"
ON storage.objects FOR DELETE
USING (bucket_id = 'pfms-purchase-fms');
