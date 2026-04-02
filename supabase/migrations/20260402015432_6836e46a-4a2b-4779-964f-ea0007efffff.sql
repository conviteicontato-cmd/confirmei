-- Fix guests INSERT/UPDATE/DELETE to use authenticated role instead of public
DROP POLICY IF EXISTS "Users can insert guests to their events" ON public.guests;
DROP POLICY IF EXISTS "Users can update guests of their events" ON public.guests;
DROP POLICY IF EXISTS "Users can delete guests from their events" ON public.guests;

CREATE POLICY "Users can insert guests to their events"
ON public.guests
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM events WHERE events.id = guests.event_id AND events.user_id = auth.uid()
  )
);

CREATE POLICY "Users can update guests of their events"
ON public.guests
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events WHERE events.id = guests.event_id AND events.user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete guests from their events"
ON public.guests
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events WHERE events.id = guests.event_id AND events.user_id = auth.uid()
  )
);