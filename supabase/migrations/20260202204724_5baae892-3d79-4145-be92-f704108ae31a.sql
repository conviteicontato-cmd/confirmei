-- CONVITEI Database Schema

-- Create profiles table for organizers
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- Create events table
CREATE TABLE public.events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  event_date DATE NOT NULL,
  short_message TEXT,
  cover_image_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  secondary_color TEXT DEFAULT '#FDF8F3',
  host_email TEXT,
  email_notifications BOOLEAN DEFAULT false,
  checkin_mode TEXT DEFAULT 'manual' CHECK (checkin_mode IN ('qr', 'manual')),
  checkin_code TEXT UNIQUE,
  webhook_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Users can view their own events"
  ON public.events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own events"
  ON public.events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own events"
  ON public.events FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own events"
  ON public.events FOR DELETE
  USING (auth.uid() = user_id);

-- Public access to events for RSVP page (by ID only)
CREATE POLICY "Public can view events by id"
  ON public.events FOR SELECT
  USING (true);

-- Create guests table
CREATE TABLE public.guests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined')),
  max_adults INTEGER DEFAULT 0,
  max_children INTEGER DEFAULT 0,
  confirmed_adults INTEGER DEFAULT 0,
  confirmed_children INTEGER DEFAULT 0,
  checkin_done BOOLEAN DEFAULT false,
  checkin_at TIMESTAMP WITH TIME ZONE,
  qr_code TEXT UNIQUE,
  qr_used BOOLEAN DEFAULT false,
  companions JSONB DEFAULT '[]'::jsonb,
  children JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on guests
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

-- Guests policies - organizers can manage their event guests
CREATE POLICY "Users can view guests of their events"
  ON public.guests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guests.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert guests to their events"
  ON public.guests FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guests.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update guests of their events"
  ON public.guests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guests.event_id 
      AND events.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete guests from their events"
  ON public.guests FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.events 
      WHERE events.id = guests.event_id 
      AND events.user_id = auth.uid()
    )
  );

-- Public access for RSVP confirmation
CREATE POLICY "Public can view guests for RSVP"
  ON public.guests FOR SELECT
  USING (true);

CREATE POLICY "Public can update guest confirmation"
  ON public.guests FOR UPDATE
  USING (true);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guests_updated_at
  BEFORE UPDATE ON public.guests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate random checkin code
CREATE OR REPLACE FUNCTION public.generate_checkin_code()
RETURNS TRIGGER AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
  END LOOP;
  NEW.checkin_code := result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate checkin code
CREATE TRIGGER generate_event_checkin_code
  BEFORE INSERT ON public.events
  FOR EACH ROW
  WHEN (NEW.checkin_code IS NULL)
  EXECUTE FUNCTION public.generate_checkin_code();

-- Function to generate QR code identifier
CREATE OR REPLACE FUNCTION public.generate_qr_code()
RETURNS TRIGGER AS $$
BEGIN
  NEW.qr_code := gen_random_uuid()::text;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger to auto-generate QR code
CREATE TRIGGER generate_guest_qr_code
  BEFORE INSERT ON public.guests
  FOR EACH ROW
  WHEN (NEW.qr_code IS NULL)
  EXECUTE FUNCTION public.generate_qr_code();

-- Create profile automatically on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger for automatic profile creation
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();