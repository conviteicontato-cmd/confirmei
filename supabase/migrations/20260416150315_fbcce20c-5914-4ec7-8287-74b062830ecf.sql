
CREATE TABLE public.whatsapp_message_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  guest_id uuid NOT NULL,
  template_type text NOT NULL,
  message_content text NOT NULL,
  action_type text NOT NULL,
  sent_at timestamp with time zone NOT NULL DEFAULT now(),
  sent_by uuid
);

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of their events"
ON public.whatsapp_message_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM events WHERE events.id = whatsapp_message_logs.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can insert logs for their events"
ON public.whatsapp_message_logs
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM events WHERE events.id = whatsapp_message_logs.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all logs"
ON public.whatsapp_message_logs
FOR ALL
USING (is_super_admin(auth.uid()))
WITH CHECK (is_super_admin(auth.uid()));

CREATE INDEX idx_wa_logs_event_guest ON public.whatsapp_message_logs (event_id, guest_id);
