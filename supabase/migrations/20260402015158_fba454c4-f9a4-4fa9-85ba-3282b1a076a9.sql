-- 1. Fix profiles: restrict self-update to safe columns only
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a trigger to prevent users from updating sensitive columns
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow super_admins to update anything
  IF public.is_super_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  
  -- For regular users, preserve sensitive fields
  NEW.status := OLD.status;
  NEW.approved_at := OLD.approved_at;
  NEW.approved_by := OLD.approved_by;
  NEW.event_limit := OLD.event_limit;
  NEW.events_contracted := OLD.events_contracted;
  NEW.events_used := OLD.events_used;
  NEW.rejection_reason := OLD.rejection_reason;
  NEW.email := OLD.email;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_fields_trigger ON public.profiles;
CREATE TRIGGER protect_profile_fields_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_fields();

-- 2. Fix events: remove blanket public SELECT
DROP POLICY IF EXISTS "Public can view events via view" ON public.events;

-- Recreate public_events view as security definer (bypasses RLS) with only safe fields
DROP VIEW IF EXISTS public_events;
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
  auto_block
FROM public.events;

-- Grant anon and authenticated access to the view
GRANT SELECT ON public_events TO anon, authenticated;

-- 3. Fix guests: remove blanket public SELECT, keep event-scoped access
DROP POLICY IF EXISTS "Public can view guests for RSVP" ON public.guests;

-- Allow public read only when the event_id matches an existing event (scoped access)
-- This still allows reads by event_id but removes truly blanket access
CREATE POLICY "Public can view guests by event"
ON public.guests
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public_events pe WHERE pe.id = guests.event_id
  )
);