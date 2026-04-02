

## Plano: Sidebar fix + Permissão de edição do Anfitrião + Filtros de status

### 1. Fix CSS do "Admin Panel" no Sidebar

**Arquivo:** `src/components/dashboard/Sidebar.tsx` (linha 73)

Remover `text-primary` da classe do botão Admin Panel. A classe `text-primary` do Tailwind é sobrescrita pela regra CSS do `.nav-item` que define `color` diretamente. Sem `text-primary`, o botão terá a mesma aparência dos demais itens.

### 2. Migração SQL

```sql
ALTER TABLE public.events ADD COLUMN allow_host_edit boolean NOT NULL DEFAULT false;
```

### 3. ShareHostModal — Toggle de permissão

**Arquivo:** `src/components/event/ShareHostModal.tsx`

- Adicionar prop `currentAllowEdit: boolean`
- Adicionar um Switch com label "Permitir que o anfitrião adicione ou exclua convidados"
- Ao alternar, salvar `allow_host_edit` no banco via `supabase.from("events").update()`

**Arquivo:** `src/components/event/EventManagement.tsx`

- Adicionar `allow_host_edit` ao tipo `Event` (linha 38-40)
- Passar `currentAllowEdit={event.allow_host_edit}` ao `ShareHostModal`

### 4. GuestTableReadOnly — Filtro de status

**Arquivo:** `src/components/event/GuestTableReadOnly.tsx`

- Adicionar estado `statusFilter` com opções: "Todos", "Confirmados", "Pendentes", "Check-in"
- Adicionar Select dropdown ao lado dos filtros existentes
- Aplicar no `filteredGuests`: filtrar por `status === "confirmed"`, `status === "pending"`, ou `checkin_done === true`

### 5. HostView — Modo edição condicional

**Arquivo:** `src/pages/HostView.tsx`

- Buscar `allow_host_edit` do evento após autenticação
- Se `true`: renderizar `GuestTable` + botão "+ Convidado" + `AddGuestModal` + `EditGuestModal`
- Se `false`: renderizar `GuestTableReadOnly` (leitura)
- Adicionar filtro de status ao `GuestTableReadOnly` (já implementado no passo 4)

**Arquivo:** `supabase/functions/verify-host-password/index.ts`

- Adicionar `allow_host_edit` ao select (linha 31)
- Incluir `allow_host_edit` no retorno JSON de sucesso

### Arquivos a modificar

| Arquivo | Ação |
|---|---|
| Migração SQL | `ADD COLUMN allow_host_edit` |
| `src/components/dashboard/Sidebar.tsx` | Remover `text-primary` (1 linha) |
| `src/components/event/ShareHostModal.tsx` | Adicionar Switch allow_host_edit |
| `src/components/event/EventManagement.tsx` | Tipo Event + prop ao modal |
| `src/components/event/GuestTableReadOnly.tsx` | Adicionar filtro status |
| `src/pages/HostView.tsx` | Lógica condicional edição vs leitura |
| `supabase/functions/verify-host-password/index.ts` | Retornar allow_host_edit |

