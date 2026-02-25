-- Add group_name column to guests table
ALTER TABLE public.guests ADD COLUMN group_name TEXT DEFAULT NULL;

-- Add index for filtering by group
CREATE INDEX idx_guests_group_name ON public.guests (event_id, group_name);