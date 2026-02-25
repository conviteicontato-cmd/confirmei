-- Add event_limit column to profiles (null means use system default)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS event_limit INTEGER DEFAULT NULL;

-- Create table to track limit change history
CREATE TABLE public.user_limit_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  previous_limit INTEGER,
  new_limit INTEGER,
  changed_by UUID NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_limit_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for limit history
CREATE POLICY "Super admins can view all limit history"
ON public.user_limit_history
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Super admins can insert limit history"
ON public.user_limit_history
FOR INSERT
WITH CHECK (public.is_super_admin(auth.uid()));

-- Create function to get user event count
CREATE OR REPLACE FUNCTION public.get_user_event_count(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.events
  WHERE user_id = _user_id
$$;

-- Create function to check if user can create event
CREATE OR REPLACE FUNCTION public.can_user_create_event(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_limit INTEGER;
  event_count INTEGER;
  system_limit INTEGER;
BEGIN
  -- Get user's individual limit
  SELECT event_limit INTO user_limit FROM public.profiles WHERE user_id = _user_id;
  
  -- If no individual limit, get system default
  IF user_limit IS NULL THEN
    SELECT (value::text)::integer INTO system_limit 
    FROM public.system_settings 
    WHERE key = 'max_events_per_user';
    user_limit := COALESCE(system_limit, 50);
  END IF;
  
  -- -1 means unlimited
  IF user_limit = -1 THEN
    RETURN TRUE;
  END IF;
  
  -- Get current event count
  SELECT public.get_user_event_count(_user_id) INTO event_count;
  
  RETURN event_count < user_limit;
END;
$$;