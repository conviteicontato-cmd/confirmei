-- Add observations column to guests table
ALTER TABLE public.guests ADD COLUMN IF NOT EXISTS observations text;

-- Add comment for documentation
COMMENT ON COLUMN public.guests.observations IS 'Internal notes from the organizer, not visible to guests';