## Plano: Sidebar fix + Permissão de edição do Anfitrião + Filtros de status

### 1. Fix CSS do "Admin Panel" no Sidebar

**Arquivo:** `src/components/dashboard/Sidebar.tsx` (linha 73)

O botão usa `className="nav-item w-full mt-4 text-primary"`. A classe `text-primary` é sobrescrita pelo `color` inline do `.nav-item` no CSS (`color: hsl(var(--sidebar-foreground) / 0.7)`). O `text-primary` do Tailwind não vence a regra CSS direta.

**Correção:** Remover `text-primary` e usar a mesma classe dos outros itens. Resultado: visível como os demais.

### 2. Migração: `allow_host_edit`

```sql
ALTER TABLE public.events ADD COLUMN allow_host_edit boolean NOT NULL DEFAULT false;
```

### 3. Toggle no `ShareHostModal`

**Arquivo:** `src/components/event/ShareHostModal.tsx`

- Adicionar prop `currentAllowEdit: boolean` e callback `onAllowEditChange`
- Adicionar Switch/Checkbox com label "Permitir que o anfitrião adicione ou exclua convidados"
- Ao alternar, fazer `supabase.from("events").update({ allow_host_edit })` direto

**Arquivo:** `src/components/event/EventManagement.tsx`

- Incluir `allow_host_edit` no select do evento
- Passar para o ShareHostModal

### 4. Filtro de status no `GuestTableReadOnly`

**Arquivo:** `src/components/event/GuestTableReadOnly.tsx`

- Adicionar dropdown de filtro por status: "Todos", "Confirmados", "Pendentes", "Check-in"
- Aplicar no `filteredGuests` junto com search e group filter

### 5. Modo edição condicional no `HostView`

**Arquivo:** `src/pages/HostView.tsx`

- Buscar `allow_host_edit` do evento após autenticação
- Se `true`: renderizar `GuestTable` (completo, com ações) + botão "+ Convidado" + `AddGuestModal` + `EditGuestModal`
- Se `false`: renderizar `GuestTableReadOnly` (atual, sem ações)
- A edge function `verify-host-password` já retorna dados do evento; adicionar `allow_host_edit` na resposta

**Arquivo:** `supabase/functions/verify-host-password/index.ts`

- Incluir `allow_host_edit` no retorno após autenticação bem-sucedida

### Arquivos a editar

| Arquivo | Ação |
|---|---|
| Migração SQL | ADD COLUMN `allow_host_edit` |
| `src/components/dashboard/Sidebar.tsx` | Fix classe CSS (1 linha) |
| `src/components/event/ShareHostModal.tsx` | Adicionar toggle allow_host_edit |
| `src/components/event/EventManagement.tsx` | Passar allow_host_edit ao modal |
| `src/components/event/GuestTableReadOnly.tsx` | Adicionar filtro de status |
| `src/pages/HostView.tsx` | Lógica condicional read-only vs edição |
| `supabase/functions/verify-host-password/index.ts` | Retornar allow_host_edit |
