
-- Add confirmation control fields to events
ALTER TABLE public.events
  ADD COLUMN confirmation_active boolean NOT NULL DEFAULT true,
  ADD COLUMN confirmation_deadline timestamptz DEFAULT NULL,
  ADD COLUMN auto_block boolean NOT NULL DEFAULT false;

-- Add confirmed_at to guests
ALTER TABLE public.guests
  ADD COLUMN confirmed_at timestamptz DEFAULT NULL;

-- Update public_events view to expose new fields
CREATE OR REPLACE VIEW public.public_events AS
SELECT
  id, name, event_date, short_message, cover_image_url,
  primary_color, secondary_color, webhook_url,
  confirmation_active, confirmation_deadline, auto_block
FROM public.events;
