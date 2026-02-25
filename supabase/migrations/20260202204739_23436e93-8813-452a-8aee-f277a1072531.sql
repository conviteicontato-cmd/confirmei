-- Fix permissive RLS policies for guests table
-- Remove the overly permissive UPDATE policy
DROP POLICY IF EXISTS "Public can update guest confirmation" ON public.guests;

-- Create a more restrictive policy - guests can only be updated by event owners
-- Public RSVP updates will be handled through an edge function that uses service role