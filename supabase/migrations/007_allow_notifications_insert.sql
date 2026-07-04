-- Allow authenticated users to create notifications for friend requests and other app events
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'Allow authenticated users to create notifications'
  ) THEN
    CREATE POLICY "Allow authenticated users to create notifications"
      ON public.notifications
      FOR INSERT
      WITH CHECK (auth.role() = 'authenticated' AND auth.uid() IS NOT NULL);
  END IF;
END $$;
