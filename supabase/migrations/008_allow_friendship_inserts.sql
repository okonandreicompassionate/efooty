-- Allow authenticated users to create friendship rows where they are either the requester or the addressee
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'friendships'
      AND policyname = 'Allow users to create friendship requests'
  ) THEN
    CREATE POLICY "Allow users to create friendship requests"
      ON public.friendships
      FOR INSERT
      WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() IS NOT NULL
        AND (
          auth.uid()::text = requester_id::text
          OR auth.uid()::text = addressee_id::text
        )
      );
  END IF;
END $$;
