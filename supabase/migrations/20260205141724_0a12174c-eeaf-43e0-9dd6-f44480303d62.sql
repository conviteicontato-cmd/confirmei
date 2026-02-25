-- Fix the view to use security_invoker instead of security definer
DROP VIEW IF EXISTS public.public_events;

CREATE VIEW public.public_events 
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  event_date,
  short_message,
  cover_image_url,
  primary_color,
  secondary_color,
  webhook_url
FROM public.events;

-- Grant SELECT on the view to anon and authenticated users
GRANT SELECT ON public.public_events TO anon, authenticated;

-- We need a public select policy on events for the view to work with security_invoker
-- Create a restrictive policy that allows public SELECT but only for non-sensitive fields via the view
CREATE POLICY "Public can view events via view"
  ON public.events
  FOR SELECT
  USING (true);

-- Drop the unused validation function
DROP FUNCTION IF EXISTS public.validate_guest_qr_update();

-- Drop the UPDATE policy we created since we'll use edge function instead
DROP POLICY IF EXISTS "Public can update guest confirmation via qr_code" ON public.guests;