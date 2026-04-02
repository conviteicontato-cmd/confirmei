-- Drop policy first, then view
DROP POLICY IF EXISTS "Public can view guests by event" ON public.guests;
DROP VIEW IF EXISTS public_events CASCADE;

CREATE VIEW public_events
WITH (security_invoker = false)
AS SELECT 
  id,
  name,
  event_date,
  short_message,
  cover_image_url,
  primary_color,
  secondary_color,
  confirmation_active,
  confirmation_deadline,
  auto_block,
  checkin_code
FROM public.events;

GRANT SELECT ON public_events TO anon, authenticated;

CREATE POLICY "Public can view guests by event"
ON public.guests
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public_events pe WHERE pe.id = guests.event_id
  )
);