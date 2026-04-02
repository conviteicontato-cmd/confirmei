

## Plano: Visão do Anfitrião (Read-Only)

### Resumo

Criar uma funcionalidade que permite ao organizador compartilhar um link protegido por senha com o anfitrião (ex: noiva), onde ele vê stats e lista de convidados sem poder editar nada.

---

### 1. Migração de Banco

Adicionar coluna `host_password` (text, nullable) na tabela `events`.

```sql
ALTER TABLE public.events ADD COLUMN host_password text;
```

### 2. Edge Function `verify-host-password`

Similar à `verify-checkin-password` existente:
- Recebe `event_id` + `password`
- Busca evento por ID
- Se não tem `host_password` definida: erro 403
- Compara senha; se correta: retorna token de sessão (8h) + dados do evento
- Se incorreta: erro 401

### 3. Nova Rota e Página `HostView`

**Rota:** `/evento/:eventId/anfitriao` no `App.tsx`

**Página `src/pages/HostView.tsx`:**
- Estados: `loading` → `login` → `authenticated`
- Tela de login: design minimalista (logo/nome evento + campo senha + botão "Acessar")
- Sessão em localStorage (8h), mesma lógica do `PublicCheckin`
- Botão "Sair"

**Após autenticação:**
- Fetch dos guests via edge function (ou query pública, já que `guests` tem SELECT público)
- Renderiza:
  - `EventStatsCards` (reutilizado) — Total, Confirmados, Pendentes, Pessoas Esperadas, Check-ins
  - Barra de progresso (confirmados / total)
  - Tabela/lista de convidados read-only (novo componente `GuestTableReadOnly`)
    - Busca e filtro por grupo (reutilizado)
    - Sem coluna "Ações", sem botões Editar/Excluir/Redefinir
    - Sem dropdown de ações no mobile
- **Oculto:** botões + Convidado, Importar CSV, Exportar CSV, qualquer ação de edição

### 4. Componente `GuestTableReadOnly`

Versão simplificada do `GuestTable` existente:
- Mantém: busca, filtro por grupo, badges de status, obs tooltip
- Remove: todas as ações (editar, excluir, redefinir, reenviar webhook)
- Remove: coluna "Ações" na tabela desktop
- Remove: dropdown no card mobile

### 5. Modal "Compartilhar com Anfitrião"

No `EventManagement.tsx`, adicionar botão "Compartilhar com Anfitrião" ao lado do "Ver Página":

**Componente `ShareHostModal`:**
- Campo para definir/atualizar senha do anfitrião (4-6 dígitos)
- Exibe link gerado: `{origin}/evento/{eventId}/anfitriao`
- Botão "Copiar Link e Senha" → copia texto formatado para clipboard:
  ```
  Acompanhe as confirmações do evento:
  Link: https://...
  Senha: 1234
  ```
- Salva `host_password` no evento via `supabase.from("events").update()`

### 6. Configuração do `EventSettings`

Adicionar campo "Senha do Anfitrião" na seção de configurações, similar ao campo de senha de check-in já existente.

---

### Arquivos

| Arquivo | Ação |
|---|---|
| Migração SQL | `ADD COLUMN host_password` |
| `supabase/functions/verify-host-password/index.ts` | Criar |
| `src/pages/HostView.tsx` | Criar |
| `src/components/event/GuestTableReadOnly.tsx` | Criar |
| `src/components/event/ShareHostModal.tsx` | Criar |
| `src/components/event/EventManagement.tsx` | Editar (adicionar botão) |
| `src/App.tsx` | Editar (nova rota) |

