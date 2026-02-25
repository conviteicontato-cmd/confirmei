-- Add consumable events fields to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS events_contracted INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS events_used INTEGER DEFAULT 0;

-- Update user_limit_history to track credit changes
ALTER TABLE public.user_limit_history
ADD COLUMN IF NOT EXISTS change_type TEXT DEFAULT 'limit_change',
ADD COLUMN IF NOT EXISTS old_value INTEGER,
ADD COLUMN IF NOT EXISTS new_value INTEGER;

-- Function to get available events (balance) for a user
CREATE OR REPLACE FUNCTION public.get_available_events(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT GREATEST(0, COALESCE(events_contracted, 0) - COALESCE(events_used, 0))
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Updated function to check if user can create event (respects Super Admin)
CREATE OR REPLACE FUNCTION public.can_user_create_event(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
  available INTEGER;
BEGIN
  -- Check if user is super_admin - they have unlimited access
  SELECT public.is_super_admin(_user_id) INTO is_admin;
  IF is_admin THEN
    RETURN TRUE;
  END IF;
  
  -- For regular users, check available events balance
  SELECT public.get_available_events(_user_id) INTO available;
  RETURN available > 0;
END;
$$;

-- Function to consume an event credit (called by trigger)
CREATE OR REPLACE FUNCTION public.consume_event_credit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is super_admin - don't consume credits
  SELECT public.is_super_admin(NEW.user_id) INTO is_admin;
  IF is_admin THEN
    RETURN NEW;
  END IF;
  
  -- Consume one credit for regular users
  UPDATE public.profiles
  SET events_used = COALESCE(events_used, 0) + 1
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-consume credits on event creation
DROP TRIGGER IF EXISTS consume_event_credit_trigger ON public.events;
CREATE TRIGGER consume_event_credit_trigger
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.consume_event_credit();

-- Migrate existing data: set events_contracted based on current event_limit
-- and events_used based on current event count
UPDATE public.profiles p
SET 
  events_contracted = COALESCE(
    CASE WHEN event_limit = -1 THEN 0 ELSE event_limit END, 
    (SELECT (value::text)::integer FROM system_settings WHERE key = 'max_events_per_user')
  ),
  events_used = (SELECT COUNT(*) FROM events WHERE user_id = p.user_id)
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur WHERE ur.user_id = p.user_id AND ur.role = 'super_admin'
);