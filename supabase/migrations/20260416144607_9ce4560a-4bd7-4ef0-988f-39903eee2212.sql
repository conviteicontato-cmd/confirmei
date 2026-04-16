
CREATE TABLE public.whatsapp_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  template_type text NOT NULL CHECK (template_type IN ('confirmation', 'reminder', 'extra')),
  title text NOT NULL,
  message_body text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, template_type)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view templates of their events"
ON public.whatsapp_templates FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.events WHERE events.id = whatsapp_templates.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can insert templates for their events"
ON public.whatsapp_templates FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.events WHERE events.id = whatsapp_templates.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can update templates of their events"
ON public.whatsapp_templates FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.events WHERE events.id = whatsapp_templates.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Users can delete templates of their events"
ON public.whatsapp_templates FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.events WHERE events.id = whatsapp_templates.event_id AND events.user_id = auth.uid()
));

CREATE POLICY "Super admins can manage all templates"
ON public.whatsapp_templates FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_whatsapp_templates_updated_at
BEFORE UPDATE ON public.whatsapp_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
