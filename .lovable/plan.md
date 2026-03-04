

## Plano: Notificações por E-mail + Check-in Público com Senha

### Diagnóstico

**E-mail:** O toggle e campo `host_email` existem no `EventSettings`, são salvos no banco (`events.email_notifications`, `events.host_email`), mas o `confirm-guest` edge function **não dispara nenhum e-mail** após a confirmação. Não há edge function de envio de e-mail nem integração com provedor.

**Check-in público:** A rota `/checkin/:code` **não existe** no `App.tsx`. O link gerado em EventSettings (`/checkin/{checkinCode}`) leva a 404. Não há página pública de check-in nem campo de senha no banco.

---

### (A) Notificações por E-mail

**1. Edge function `send-confirmation-email`**
- Nova edge function que recebe: `event_id`, `guest_id`, `host_email`, `event_name`, `guest_name`, `confirmed_adults`, `confirmed_children`, `group_name`
- Usa a Lovable AI API (LOVABLE_API_KEY) para envio de e-mail transacional, OU implementa via o webhook existente (`send-webhook`) como fallback
- Assunto: `"Nova confirmação – {event_name}"`
- Corpo: nome do convidado, adultos, crianças, grupo, data/hora
- Retry: 3 tentativas com backoff
- Retorna log de sucesso/falha

**2. Integrar no `confirm-guest`**
- Após confirmação bem-sucedida, buscar `email_notifications` e `host_email` do evento
- Se ativados, chamar `send-confirmation-email` de forma assíncrona (não bloquear a resposta do convidado)
- Logar resultado no console

**3. UI de indisponibilidade**
- No `EventSettings`, se e-mail não estiver configurado no backend (sem provedor), mostrar aviso amarelo: "Envio de e-mail ainda não configurado"

**Decisão de provedor:** Como o projeto tem Lovable Cloud, vou usar uma edge function que envia e-mail via `fetch` para o webhook do Make (já configurado pelo anfitrião) como mecanismo de notificação. Se o webhook não estiver configurado, o e-mail de notificação não será enviado e isso será indicado na UI.

> **Alternativa mais robusta:** Criar integração direta com Resend ou outro provedor de e-mail transacional. Isso requer API key.

---

### (B) Check-in Público com Senha

**1. Migração de banco**
- Adicionar coluna `checkin_password` (text, nullable) na tabela `events`

**2. Edge function `verify-checkin-password`**
- Recebe `checkin_code` + `password`
- Busca evento por `checkin_code`
- Se evento não encontrado: erro 404
- Se evento não tem senha: erro 403 ("Defina uma senha nas configurações")
- Compara senha (texto simples no MVP; pode evoluir para hash)
- Se correta: retorna `event_id` + token JWT temporário (8h)
- Se incorreta: erro 401

**3. Nova rota `/checkin/:code`**
- Adicionar no `App.tsx`: `<Route path="/checkin/:code" element={<PublicCheckin />} />`

**4. Nova página `PublicCheckin.tsx`**
- Busca evento pelo `checkin_code` via query pública
- Se não existe: "Código de check-in inválido"
- Se existe mas sem senha: "Check-in protegido. Defina uma senha nas configurações do evento."
- Se existe e tem senha:
  - Verifica se já tem sessão válida (localStorage token, max 8h)
  - Se não: mostra tela de senha → chama `verify-checkin-password`
  - Se sim: renderiza `CheckinPage` com `eventId` e `eventName`
- Botão "Sair do Check-in" limpa sessão

**5. Campo de senha no `EventSettings`**
- Adicionar campo "Senha do Check-in" abaixo do código
- Tipo password com toggle de visibilidade
- Salvo junto com as demais configurações no `handleSave`

**6. Segurança**
- Senha comparada server-side via edge function
- Token de sessão armazenado em localStorage com expiração de 8h
- Sem acesso direto aos dados sem validação

---

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/send-confirmation-email/index.ts` | Criar |
| `supabase/functions/verify-checkin-password/index.ts` | Criar |
| `supabase/functions/confirm-guest/index.ts` | Editar (disparar e-mail) |
| `src/pages/PublicCheckin.tsx` | Criar |
| `src/components/event/EventSettings.tsx` | Editar (campo senha) |
| `src/App.tsx` | Editar (nova rota) |
| Migração SQL | `ALTER TABLE events ADD COLUMN checkin_password text` |

### Ordem de execução
1. Migração SQL (adicionar `checkin_password`)
2. Edge functions (`send-confirmation-email`, `verify-checkin-password`)
3. Atualizar `confirm-guest` para disparar notificação
4. Frontend: `PublicCheckin.tsx`, rota, campo senha em EventSettings

