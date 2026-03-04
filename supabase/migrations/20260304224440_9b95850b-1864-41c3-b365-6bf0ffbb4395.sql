
-- Fix: drop duplicate storage policy if it was already partially applied
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Tenant members can upload assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Tenant members can upload assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'tenant-assets');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Tenant members can update assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Tenant members can update assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'tenant-assets');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Tenant members can delete assets' AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Tenant members can delete assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'tenant-assets');
  END IF;
END $$;
