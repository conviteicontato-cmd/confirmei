-- Add checkin tracking for individual companions and children
-- Each companion/child will have a checked_in boolean in their JSON object

-- First, let's update the structure by adding a comment for documentation
-- The companions and children JSONB arrays will have this structure:
-- companions: [{ "name": "John", "checked_in": false }, ...]
-- children: [{ "name": "Maria", "age": "5", "checked_in": false }, ...]

-- No schema changes needed since JSONB already supports this structure
-- The checked_in field will be added to each object when doing check-in

COMMENT ON COLUMN public.guests.companions IS 'Array of companion objects: [{ "name": "string", "checked_in": boolean }]';
COMMENT ON COLUMN public.guests.children IS 'Array of children objects: [{ "name": "string", "age": "string", "checked_in": boolean }]';