

# Confirmacao Unica + Controle de Abertura/Fechamento

## Resumo

Duas funcionalidades:
1. **Confirmacao unica por convidado** - impedir que um convidado confirme mais de uma vez, tanto na interface quanto no backend
2. **Controle de abertura/fechamento de confirmacoes** - campos no evento para ligar/desligar confirmacoes manualmente e/ou por data limite

---

## 1. Alteracoes no Banco de Dados

### Migration: Adicionar campos na tabela `events`

```sql
ALTER TABLE public.events
  ADD COLUMN confirmation_active boolean NOT NULL DEFAULT true,
  ADD COLUMN confirmation_deadline timestamptz DEFAULT NULL,
  ADD COLUMN auto_block boolean NOT NULL DEFAULT false;
```

### Migration: Adicionar campo `confirmed_at` na tabela `guests`

```sql
ALTER TABLE public.guests
  ADD COLUMN confirmed_at timestamptz DEFAULT NULL;
```

O campo `confirmed_at` registra quando o convidado confirmou. A coluna `status` ja existe com valores `pending` / `confirmed`.

### Atualizar a view `public_events`

A view `public_events` precisa expor os novos campos para que a pagina publica consiga verificar se as confirmacoes estao abertas:

```sql
CREATE OR REPLACE VIEW public.public_events AS
SELECT
  id, name, event_date, short_message, cover_image_url,
  primary_color, secondary_color, webhook_url,
  confirmation_active, confirmation_deadline, auto_block
FROM public.events;
```

---

## 2. Bloqueio de Confirmacao Duplicada

### Edge Function `confirm-guest`

Adicionar verificacao logo apos buscar o convidado:

```text
1. Buscar o guest pelo id
2. SE guest.status === 'confirmed' -> retornar erro 409 "Presenca ja registrada"
3. Buscar o evento para verificar se confirmacoes estao abertas
4. SE confirmation_active === false -> retornar erro 403 "Confirmacoes encerradas"
5. SE auto_block === true E confirmation_deadline < now() -> retornar erro 403 "Confirmacoes encerradas"
6. Prosseguir com a confirmacao normalmente
7. Ao fazer UPDATE, incluir confirmed_at: new Date().toISOString()
```

### Pagina Publica (`PublicEvent.tsx`)

Quando o convidado seleciona seu nome na busca:
- Se `guest.status === 'confirmed'`, em vez de abrir o formulario, mostrar a tela de "Presenca ja registrada" com o QR Code (reutilizando a tela de sucesso existente)
- Os botoes de confirmacao ficam ocultos

---

## 3. Controle de Abertura/Fechamento

### Pagina de Configuracoes do Evento (`EventSettings.tsx`)

Adicionar uma nova secao "Confirmacoes" com:

- **Switch "Confirmacoes ativas"** (`confirmation_active`) - liga/desliga manualmente
- **Switch "Bloqueio automatico por data"** (`auto_block`) - quando ativo, exibe o campo de data/hora
- **Campo datetime "Data limite"** (`confirmation_deadline`) - so aparece quando `auto_block` esta ativo

O `handleSave` ja existente sera atualizado para incluir os tres novos campos no UPDATE.

### Pagina Publica (`PublicEvent.tsx`)

Ao carregar o evento (que agora vem da view `public_events` com os novos campos):

1. Verificar se confirmacoes estao abertas usando a logica:
   - `confirmation_active === false` -> bloqueado
   - `auto_block === true` E `confirmation_deadline` ja passou -> bloqueado
2. Se bloqueado: exibir mensagem "Confirmacoes encerradas para este evento" e ocultar o campo de busca e todos os botoes de confirmacao

---

## 4. Arquivos Modificados

| Arquivo | Alteracao |
|---------|-----------|
| **Migration SQL** | Adicionar 3 colunas em `events`, 1 coluna em `guests`, atualizar view `public_events` |
| `supabase/functions/confirm-guest/index.ts` | Verificar status duplicado (409), verificar confirmacao aberta (403), salvar `confirmed_at` |
| `src/pages/PublicEvent.tsx` | Verificar bloqueio ao carregar evento, redirecionar convidado ja confirmado para tela de sucesso |
| `src/components/event/EventSettings.tsx` | Adicionar secao com 3 novos campos (switch + datetime), incluir no save |

### Interfaces atualizadas

- `EventData` em `PublicEvent.tsx`: adicionar `confirmation_active`, `confirmation_deadline`, `auto_block`
- `EventData` em `EventSettings.tsx`: adicionar os mesmos campos
- `GuestData` em `PublicEvent.tsx`: adicionar `confirmed_at`

---

## 5. Fluxo do Convidado

```text
Convidado acessa link
  |
  v
Evento carregado -> Confirmacoes abertas?
  |                    |
  Nao                  Sim
  |                    |
  v                    v
"Confirmacoes       Busca por nome
 encerradas"           |
                       v
                    Seleciona nome -> Ja confirmou?
                       |                |
                       Sim              Nao
                       |                |
                       v                v
                    "Presenca ja     Formulario RSVP
                     registrada"        |
                    + QR Code           v
                                     Confirma -> Edge Function
                                        |
                                        v
                                     Tela sucesso + QR Code
```

