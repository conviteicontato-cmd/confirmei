
-- Add qr_children config to events
ALTER TABLE public.events ADD COLUMN qr_children boolean NOT NULL DEFAULT false;

-- Create guest_participants table
CREATE TABLE public.guest_participants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  name text,
  type text NOT NULL CHECK (type IN ('main', 'adult', 'child')),
  qr_code text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  checked_in_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.guest_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_gp_event_guest ON public.guest_participants (event_id, guest_id);
CREATE INDEX idx_gp_qr_code ON public.guest_participants (qr_code);

CREATE POLICY "Users can view participants of their events"
ON public.guest_participants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = guest_participants.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can insert participants for their events"
ON public.guest_participants FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM events WHERE events.id = guest_participants.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can update participants of their events"
ON public.guest_participants FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = guest_participants.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can delete participants of their events"
ON public.guest_participants FOR DELETE
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = guest_participants.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all participants"
ON public.guest_participants FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Public can view participants by event"
ON public.guest_participants FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public_events pe WHERE pe.id = guest_participants.event_id
));
