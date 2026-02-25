-- Permitir que usuários anônimos leiam as configurações do sistema (necessário para verificar se cadastros estão habilitados)
CREATE POLICY "Anyone can view settings anon" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Remover a policy antiga que era restrita a autenticados
DROP POLICY IF EXISTS "Anyone can view settings" ON public.system_settings;