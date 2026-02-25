
-- Fix security definer view by setting it to SECURITY INVOKER
ALTER VIEW public.public_events SET (security_invoker = on);
