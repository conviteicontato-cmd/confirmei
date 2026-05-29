-- 1. Add differentiated credit columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_standard INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_qr INTEGER NOT NULL DEFAULT 0;

-- 2. Add credit_type column to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS credit_type TEXT DEFAULT 'standard';

-- Add CHECK constraint for credit_type (guarded so re-runs don't fail)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_credit_type_check'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_credit_type_check CHECK (credit_type IN ('standard', 'qr'));
  END IF;
END $$;

-- 3. Update can_user_create_event to consider credit type
--    Overloaded version that takes the credit type into account
CREATE OR REPLACE FUNCTION public.can_user_create_event(_user_id uuid, _credit_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin BOOLEAN;
  available INTEGER;
BEGIN
  -- Super admins have unlimited access
  SELECT public.is_super_admin(_user_id) INTO is_admin;
  IF is_admin THEN
    RETURN TRUE;
  END IF;

  IF _credit_type = 'qr' THEN
    SELECT COALESCE(credits_qr, 0) INTO available
    FROM public.profiles WHERE user_id = _user_id;
  ELSE
    SELECT COALESCE(credits_standard, 0) INTO available
    FROM public.profiles WHERE user_id = _user_id;
  END IF;

  RETURN COALESCE(available, 0) > 0;
END;
$function$;

-- Keep the single-arg version working: true if ANY credit type is available
CREATE OR REPLACE FUNCTION public.can_user_create_event(_user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin BOOLEAN;
  std INTEGER;
  qr INTEGER;
BEGIN
  SELECT public.is_super_admin(_user_id) INTO is_admin;
  IF is_admin THEN
    RETURN TRUE;
  END IF;

  SELECT COALESCE(credits_standard, 0), COALESCE(credits_qr, 0)
  INTO std, qr
  FROM public.profiles WHERE user_id = _user_id;

  RETURN COALESCE(std, 0) > 0 OR COALESCE(qr, 0) > 0;
END;
$function$;

-- 4. Create consume_event_credit(_user_id, _credit_type) function
CREATE OR REPLACE FUNCTION public.consume_event_credit(_user_id uuid, _credit_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  is_admin BOOLEAN;
  available INTEGER;
BEGIN
  -- Super admins always succeed without decrementing anything
  SELECT public.is_super_admin(_user_id) INTO is_admin;
  IF is_admin THEN
    RETURN TRUE;
  END IF;

  IF _credit_type = 'qr' THEN
    SELECT COALESCE(credits_qr, 0) INTO available
    FROM public.profiles WHERE user_id = _user_id;

    IF COALESCE(available, 0) <= 0 THEN
      RETURN FALSE;
    END IF;

    UPDATE public.profiles
    SET credits_qr = COALESCE(credits_qr, 0) - 1
    WHERE user_id = _user_id;
  ELSE
    SELECT COALESCE(credits_standard, 0) INTO available
    FROM public.profiles WHERE user_id = _user_id;

    IF COALESCE(available, 0) <= 0 THEN
      RETURN FALSE;
    END IF;

    UPDATE public.profiles
    SET credits_standard = COALESCE(credits_standard, 0) - 1
    WHERE user_id = _user_id;
  END IF;

  RETURN TRUE;
END;
$function$;