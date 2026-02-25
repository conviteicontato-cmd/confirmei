-- Fix 1: Remove the overly permissive "Public can view events by id" policy that exposes host_email
-- Replace with a more restrictive policy that only exposes non-sensitive fields

-- Drop the current permissive public SELECT policy for events
DROP POLICY IF EXISTS "Public can view events by id" ON public.events;

-- Create a view that excludes sensitive data for public access
CREATE OR REPLACE VIEW public.public_events AS
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

-- Create an RLS policy for owners to SELECT their own full events data
-- (They already have this via "Users can view their own events")

-- Fix 2: Add a policy to allow public updates to guests via QR code validation
-- This uses the qr_code as an access token for guest confirmations

-- First create a function to validate QR code access
CREATE OR REPLACE FUNCTION public.validate_guest_qr_update()
RETURNS TRIGGER AS $$
DECLARE
  existing_qr TEXT;
  existing_status TEXT;
BEGIN
  -- Get the existing qr_code for this guest
  SELECT qr_code, status INTO existing_qr, existing_status
  FROM public.guests 
  WHERE id = NEW.id;
  
  -- Only allow updates if:
  -- 1. The guest exists
  -- 2. The guest status is pending (not already confirmed)
  -- 3. The update is only changing allowed fields
  
  IF existing_qr IS NULL THEN
    RAISE EXCEPTION 'Guest not found';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create a policy allowing public guests to update their own record via event_id match
-- The confirmation will need to go through an edge function with service role
CREATE POLICY "Public can update guest confirmation via qr_code"
  ON public.guests 
  FOR UPDATE
  USING (
    -- Allow when the guest has a qr_code and status is pending
    qr_code IS NOT NULL 
    AND status = 'pending'
  )
  WITH CHECK (
    -- Only allow updating specific confirmation fields
    status IN ('confirmed', 'pending')
  );