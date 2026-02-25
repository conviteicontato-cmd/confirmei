

## Design System Overhaul: Poppins + Cream/Beige/Deep Ocean

### Current State

The project currently uses:
- **Inter** as body font and **Playfair Display** (serif) for headings -- mixed typography
- **Golden/Amber** (#D4AF37) as primary color with cream secondary
- `font-display` class used in ~63 files for headings
- `btn-gold` class with golden gradient used in ~12 files
- CSS variables defined in `src/index.css`, font families in `tailwind.config.ts`

### Plan

The entire rebrand is achievable by editing **only 2 files** -- the design tokens propagate automatically via CSS variables and Tailwind classes.

---

#### 1. `src/index.css` -- Replace design tokens and font

- Replace Google Fonts import: swap `Playfair Display + Inter` for `Poppins` with weights 300-700
- Update comment block to reflect new design system
- **Light mode `:root`** -- convert all HSL values to the new palette:

| Token | New Value (HSL) | Source |
|---|---|---|
| `--background` | `30 23% 92%` | Cream #EEE8DF |
| `--foreground` | `227 35% 26%` | Deep Ocean #2C365A |
| `--card` | `30 23% 92%` | Cream #EEE8DF |
| `--card-foreground` | `227 35% 26%` | Deep Ocean |
| `--popover` | `0 0% 100%` | White (popovers stay white for contrast) |
| `--popover-foreground` | `227 35% 26%` | Deep Ocean |
| `--primary` | `227 35% 26%` | Deep Ocean #2C365A |
| `--primary-foreground` | `30 23% 92%` | Cream #EEE8DF |
| `--secondary` | `26 12% 72%` | Beige #C4BCB0 |
| `--secondary-foreground` | `227 35% 26%` | Deep Ocean |
| `--muted` | `26 12% 78%` | Lighter Beige |
| `--muted-foreground` | `227 20% 45%` | Muted Deep Ocean |
| `--accent` | `26 15% 85%` | Light Beige tint |
| `--accent-foreground` | `227 35% 26%` | Deep Ocean |
| `--border` | `26 12% 80%` | Beige-ish border |
| `--input` | `26 12% 80%` | Same |
| `--ring` | `227 35% 26%` | Deep Ocean |
| `--success` | `145 40% 45%` | Soft green |
| `--warning` | `38 60% 55%` | Soft amber |
| `--destructive` | `0 55% 55%` | Desaturated red |

- **Sidebar tokens**: background Deep Ocean, foreground Cream, active accent
- **Gradients**: replace gold gradients with Deep Ocean gradients
- **Shadows**: replace gold shadow with Deep Ocean shadow
- **Dark mode**: update similarly with darker Deep Ocean base

- **Body font rule**: change `font-family: 'Inter'` to `font-family: 'Poppins'`
- **Heading rule**: remove `font-family: 'Playfair Display', serif` -- headings will inherit Poppins, add `font-weight: 600`
- **`.btn-gold`**: rename conceptually to `.btn-primary` (keep `.btn-gold` as alias for compatibility) -- change gradient to Deep Ocean tones, shadow to Deep Ocean shadow

---

#### 2. `tailwind.config.ts` -- Update font families

```typescript
fontFamily: {
  sans: ['Poppins', 'sans-serif'],
  display: ['Poppins', 'sans-serif'], // keep class name for compatibility, same font
},
```

No other Tailwind changes needed -- all colors already reference CSS variables.

---

#### 3. What does NOT need changing

- **No component files need editing.** All 63+ files using `font-display` will automatically render Poppins 600 instead of Playfair Display. All files using `btn-gold` will automatically get Deep Ocean styling. All color references like `bg-primary`, `text-foreground`, `bg-card` resolve to CSS variables.
- No shadcn/ui component changes needed -- they all use the token system.
- No page-level changes needed.

---

#### Summary of file changes

| File | Change |
|---|---|
| `src/index.css` | Replace font import, all CSS variable values, gradient/shadow definitions, body/heading font rules |
| `tailwind.config.ts` | Replace font families (both `sans` and `display` to Poppins) |

Total: **2 files**, zero component changes. The design token architecture ensures global propagation.

