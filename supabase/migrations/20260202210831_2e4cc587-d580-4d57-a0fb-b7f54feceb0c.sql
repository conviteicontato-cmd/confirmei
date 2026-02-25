-- Create storage bucket for event cover images
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

-- Create policies for event cover uploads
CREATE POLICY "Anyone can view event covers"
ON storage.objects
FOR SELECT
USING (bucket_id = 'event-covers');

CREATE POLICY "Users can upload their own event covers"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own event covers"
ON storage.objects
FOR UPDATE
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own event covers"
ON storage.objects
FOR DELETE
USING (bucket_id = 'event-covers' AND auth.uid()::text = (storage.foldername(name))[1]);