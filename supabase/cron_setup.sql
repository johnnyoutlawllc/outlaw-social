-- Run these in Supabase SQL editor after deploying edge functions.
-- Replace SUPABASE_PROJECT_REF and CRON_SECRET with actual values.

-- Enable pg_cron extension (already enabled by Supabase)
-- SELECT cron.schedule(
--   'ingest-facebook-8am',
--   '0 8 * * *',  -- 8:00 AM UTC daily
--   $$
--   SELECT net.http_post(
--     url := 'https://SUPABASE_PROJECT_REF.supabase.co/functions/v1/ingest-facebook',
--     headers := '{"Authorization": "Bearer CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- SELECT cron.schedule(
--   'ingest-facebook-8pm',
--   '0 20 * * *',  -- 8:00 PM UTC daily
--   $$
--   SELECT net.http_post(
--     url := 'https://SUPABASE_PROJECT_REF.supabase.co/functions/v1/ingest-facebook',
--     headers := '{"Authorization": "Bearer CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
--     body := '{}'::jsonb
--   );
--   $$
-- );

-- Repeat same pattern for ingest-instagram and ingest-tiktok.
-- Or use the Supabase dashboard -> Edge Functions -> Schedule.
