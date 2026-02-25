-- Verificar e adicionar policy para usuários verem suas próprias roles
-- Isso é necessário para o hook useAdminRole funcionar corretamente

-- A policy "Users can view their own roles" já existe, mas vamos garantir que está funcionando
-- Primeiro, vamos verificar se existe algum problema e recriar se necessário

-- Remover policies antigas que podem estar conflitando
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

-- Criar policy explícita para usuários autenticados verem suas próprias roles
CREATE POLICY "Users can view their own roles" 
ON public.user_roles 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);