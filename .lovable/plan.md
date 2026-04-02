

## Plano: Reformulação da Paleta de Cores

### Cores (Hex → HSL)
- **Principal** `#4c0c14` → `350 75% 17%`
- **Fundo** `#f8f5f0` → `37 38% 96%`
- **Detalhes** `#ef86aa` → `340 78% 73%`

### Alterações

**Arquivo único: `src/index.css`**

Atualizar todas as CSS variables em `:root`:

| Token | Valor Atual (azul/bege) | Novo Valor |
|---|---|---|
| `--background` | `30 23% 92%` | `37 38% 96%` (#f8f5f0) |
| `--foreground` | `227 35% 26%` | `350 75% 17%` (#4c0c14) |
| `--card` | `30 23% 92%` | `0 0% 100%` (branco, contraste com fundo) |
| `--card-foreground` | `227 35% 26%` | `350 75% 17%` |
| `--popover` | `0 0% 100%` | `0 0% 100%` (manter) |
| `--popover-foreground` | `227 35% 26%` | `350 75% 17%` |
| `--primary` | `227 35% 26%` | `350 75% 17%` (#4c0c14) |
| `--primary-foreground` | `30 23% 92%` | `37 38% 96%` (#f8f5f0) |
| `--secondary` | `26 12% 72%` | `340 78% 73%` (#ef86aa) |
| `--secondary-foreground` | `227 35% 26%` | `0 0% 100%` (branco) |
| `--muted` | `26 12% 78%` | `340 30% 92%` (rosa suave) |
| `--muted-foreground` | `227 20% 45%` | `350 30% 40%` |
| `--accent` | `26 15% 85%` | `340 40% 90%` (rosa claro) |
| `--accent-foreground` | `227 35% 26%` | `350 75% 17%` |
| `--destructive` | manter vermelho | manter |
| `--border` | `26 12% 80%` | `340 20% 85%` |
| `--input` | `26 12% 80%` | `340 20% 85%` |
| `--ring` | `227 35% 26%` | `340 78% 73%` (#ef86aa para ring/foco) |
| `--sidebar-background` | `227 35% 26%` | `350 75% 17%` (#4c0c14) |
| `--sidebar-foreground` | `30 23% 92%` | `37 38% 96%` (#f8f5f0) |
| `--sidebar-accent` | `227 30% 38%` | `350 60% 25%` |
| `--sidebar-accent-foreground` | `0 0% 100%` | `0 0% 100%` |
| `--sidebar-border` | `227 25% 32%` | `350 50% 22%` |
| `--sidebar-ring` | `30 23% 92%` | `37 38% 96%` |
| `--sidebar-primary` | `30 23% 92%` | `37 38% 96%` |
| `--sidebar-primary-foreground` | `227 35% 26%` | `350 75% 17%` |

Atualizar gradientes e sombras para usar `350 75% 17%` em vez de `227 35% 26%`.

Atualizar também o tema `.dark` com variantes equivalentes.

Atualizar comentários do cabeçalho para refletir a nova paleta (Convitei: #4c0c14 / #f8f5f0 / #ef86aa).

**Botão hover rosa:** Adicionar variante no `buttonVariants` em `src/components/ui/button.tsx` — trocar o hover do variant `default` de `hover:bg-primary/90` para `hover:bg-[hsl(340,78%,73%)]` (rosa #ef86aa).

**Logo:** Copiar `Logotipo_Fundo_Tranparente.png` para `src/assets/` e usar no Sidebar em vez do texto "Organizador" / "Convitei".

### Arquivos

| Arquivo | Ação |
|---|---|
| `src/index.css` | Atualizar todas as CSS variables |
| `src/components/ui/button.tsx` | Hover rosa no variant default |
| `src/assets/Logotipo_Fundo_Tranparente.png` | Copiar logo |
| `src/components/dashboard/Sidebar.tsx` | Usar logo no header |

