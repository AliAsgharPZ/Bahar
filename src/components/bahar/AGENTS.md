# Bahar components — agent file

Read this file before writing any Bahar UI. It is the machine-readable list of
the Bahar component language. Everything here is already Bahar-customized:
tokens, radii, fonts, direction rules. Do not import a foreign kit raw and do
not invent new values.

## Status

- These components live under `src/components/bahar/` and are NEW files only.
- They are NOT wired into any page yet. Landing into pages is a separate
  follow-up step, after the Meta design migration finishes. Never wire them
  in from this file alone.
- Nothing here touches school site templates, language packs, country packs,
  or module definitions.

## Hard rules (check every diff against this list)

1. Colors: only the Bahar tokens in the table below, referenced by token
   name. Never introduce a new color value.
2. Fonts: Vazirmatn and Arad only. Latin text: Manrope only. Never set a
   different font family in new code.
3. Direction: full RTL. Use logical Tailwind utilities only: ms-, me-, ps-,
   pe-, start-, end-, text-start, border-s, border-e. Never use physical
   side utilities. Directional motion must mirror: entering from the start
   side comes from the inline-start edge (see `motion-primitives`).
4. Shape: buttons are pills (fully rounded). Cards are 32 or 16 radius.
   Inputs are height 44 with radius 8. Primary touch targets are at least
   44 in height and width.
5. Motion: every animated component respects reduced motion (static final
   state, no looping motion). Split-text animation is word level only for
   Persian text: split on whitespace, never split letters (Persian letters
   join).
6. Numbers and dates: display digits in Persian, dates in Jalali, and the
   word for the currency unit after the number. Use `format.ts` in this
   folder; never format digits or dates by hand.
7. Icons: lucide-react only.
8. No new dependency is introduced by this folder. Motion comes from the
   already installed framer-motion package (the Motion lineage). When the
   repo migrates to the `motion` package, only the import path changes.
9. Do not use compact primitives for primary touch targets: the small
   button variant is 40 high and the search pill is 40 high, both below
   the 44 minimum. Prefer the standard button (44 high) for actions.

## Tokens (names only; values live in the global stylesheet)

| Token | Role |
| --- | --- |
| --spring, --spring-deep, --spring-soft, --spring-tint | Primary green scale |
| --blossom, --blossom-tint, --blossom-foreground | Accent pink scale |
| --ink-deep, --ink, --steel, --stone | Text scale |
| --hairline, --hairline-soft, --cloud | Borders and quiet surfaces |
| --success, --success-foreground | Success fill and its text |
| --warning, --warning-foreground, --warning-deep | Warning fill, its text, readable warning text |
| --info, --info-foreground | Info fill and its text |
| --destructive, --destructive-foreground | Danger fill and its text |
| --invert, --invert-foreground | Inverse chip and button |
| --overlay | Dialog and search scrim |
| --chart-1, --chart-2, --chart-3, --chart-4, --chart-5 | Chart series |
| --background, --foreground, --card, --card-foreground | Surfaces |
| --muted, --muted-foreground, --accent, --accent-foreground | Quiet surfaces |
| --border, --input, --ring | Borders, inputs, focus |
| --radius | Base radius (cards and buttons below override it) |

Tailwind v4 maps these tokens to utilities: bg-spring, text-steel,
border-hairline-soft, bg-spring-tint, bg-chart-1, and so on. Prefer the
utility; use `var(--token)` only inside SVG attributes and gradients.

## Existing primitives (global stylesheet, reuse, do not redefine)

| Class | Behavior |
| --- | --- |
| .b-btn | Pill button, padding 14/30, min height 44. Variants: -spring, -ink, -outline, -ghost, -soft, -buy (commerce only). |
| .b-btn-lg | Pill button, padding 16/36, min height 52. |
| .b-btn-sm | Pill button, padding 10/22, min height 40. Compact only; not a primary touch target. |
| .b-card, .b-card-lg | Card, radius 32, hairline-soft border. |
| .b-card-md | Card, radius 24, hairline-soft border. |
| .b-card-sm | Card, radius 16, hairline-soft border. |
| .b-card-tint, .b-card-ink, .b-card-hover | Card fills and hover behavior. |
| .b-input | Input, height 44, radius 8, focus ring. .b-input-error for errors. |
| .b-search-pill | Compact search pill, height 40. Compact only; prefer .b-input for forms. |
| .b-pill-tab, .b-pill-tab-active | Pill tab and its active state. |
| .b-badge, .b-badge-spring, .b-badge-success, .b-badge-warning, .b-badge-critical, .b-badge-blossom, .b-badge-neutral, .b-badge-ink | Pill badges. |
| .b-option, .b-option-selected | Selectable option card and its selected state. |
| .b-rise, .b-pop, .b-page-in, .b-stagger, .b-xfade, .b-shimmer, .b-marquee | Existing entrance and ambient animations. Prefer the motion primitives in this folder for new work. |

## Component index (this folder)

| Component | File | Props (summary) | Tokens | Direction notes | Landing target (after migration) |
| --- | --- | --- | --- | --- | --- |
| BaharPage | motion/motion-primitives.tsx | children, className, delay | spring focus ring via .b-btn styles only where buttons appear | Enters from inline-start edge, mirrored by document direction; vertical fade is direction neutral | Every page shell that wants a soft entrance; public home first |
| BaharModal | motion/motion-primitives.tsx | open, onClose, title, children, labelledBy | overlay scrim, card surface | Backdrop is symmetric; close control sits at inline-end | Any /app dialog that today uses a bare overlay; consents and approvals first |
| BaharStagger, BaharStaggerItem | motion/motion-primitives.tsx | children, gap delay, className | none | Stagger is vertical; no mirroring needed | Lists on modules hub and dashboard cards |
| ThinkingOrbs | orbs/thinking-orbs.tsx | state, size (20 or 64), label | spring, spring-soft, steel | Dots are symmetric; no mirroring needed | Agent, search, and loading states across /app (replaces plain spinners) |
| StatCard | dashboard/stat-card.tsx | title, value, delta, deltaLabel, icon, spark, tone, suffix | spring, blossom, warning, info, steel; badges | Delta icon is vertical; trend text is logical | /app dashboard, /app/finance, /app/attendance |
| BaharDataTable | dashboard/data-table.tsx | columns, rows, caption, emptyText | card, hairline-soft, muted | Header alignment uses text-start; row actions sit at inline-end | /app/attendance, /app/grades, /app/finance, any list page |
| MiniChart | dashboard/mini-chart.tsx | points, kind (line or bars), series index 1-5, label | chart-1..5, spring | Chart grows along inline direction; axis labels use text-start | Inside StatCard and /app dashboard |
| AppShellPattern | dashboard/app-shell-pattern.tsx | sidebar, topbarActions, searchSlot, title, children | card, cloud, hairline-soft | Sidebar sits at inline-start; collapses below large screens | Future /app shell refresh (pattern only; never replace the live shell from here) |
| KanbanPattern | dashboard/kanban-pattern.tsx | columns, onMove, emptyText | card, card-sm, spring-tint | Columns flow in inline direction; move controls are text buttons | /app/events, /app/assignments, /app/tasks-style lists |
| SpotlightCard | landing/spotlight-card.tsx | children, title, className, glow (on/off) | spring-tint, card | Glow follows pointer; symmetric in both directions | Public home hero and feature sections |
| MagicBento, BentoCell | landing/magic-bento.tsx | children; cell: span, title, description, icon, children | card, spring-tint | Grid collapses 3/4 to 2 to 1 column; cells read in inline direction | Public home, /languages, /countries feature grids |
| WordBlurText | landing/word-blur-text.tsx | text, className, delay, once | ink | Splits on whitespace only; never splits letters | Public home headlines only (landing only) |
| NumberTicker | landing/number-ticker.tsx | value, suffix (toman, percent, none), duration | ink, steel | Digits render in Persian via format.ts | Public home stats, /app/finance totals |
| ActivityRing | landing/activity-ring.tsx | rings, size, centerLabel, centerValue | spring, blossom, warning, chart series | Rings are symmetric; labels use text-center | Attendance ring on /app/attendance, student motivation cards |
| MagneticCta | landing/magnetic-cta.tsx | children, href or onClick, variant | spring button | Magnetic offset is symmetric; no mirroring needed | Public home primary call to action only (landing only) |
| format.ts | format.ts | faNumber, faCurrency, faPercent, jalaliToday | none | Digits and dates only; callers pass display strings | Everywhere numbers or dates render |

## Import map

```ts
import { BaharPage, BaharModal, BaharStagger, BaharStaggerItem } from "@/components/bahar/motion/motion-primitives";
import { ThinkingOrbs } from "@/components/bahar/orbs/thinking-orbs";
import { StatCard } from "@/components/bahar/dashboard/stat-card";
import { BaharDataTable } from "@/components/bahar/dashboard/data-table";
import { MiniChart } from "@/components/bahar/dashboard/mini-chart";
import { AppShellPattern } from "@/components/bahar/dashboard/app-shell-pattern";
import { KanbanPattern } from "@/components/bahar/dashboard/kanban-pattern";
import { SpotlightCard } from "@/components/bahar/landing/spotlight-card";
import { MagicBento, BentoCell } from "@/components/bahar/landing/magic-bento";
import { WordBlurText } from "@/components/bahar/landing/word-blur-text";
import { NumberTicker } from "@/components/bahar/landing/number-ticker";
import { ActivityRing } from "@/components/bahar/landing/activity-ring";
import { MagneticCta } from "@/components/bahar/landing/magnetic-cta";
import { faNumber, faCurrency, faPercent, jalaliToday } from "@/components/bahar/format";
```

## License notes (patterns only, no copied vendor source)

- shadcn/ui: MIT. This folder reuses the already installed shadcn
  primitives and the copy-and-own pattern; no registry code was pasted.
- Agent-file method: this machine-readable agent file follows the method of
  listing components for agents. The source system itself (React 19 plus StyleX) was NOT
  imported; it conflicts with the Tailwind setup.
- BoardUI: free components MIT; Pro is a separate paid license and was
  NOT used. Stat cards, tables, and charts here are original Bahar
  implementations of the free-tier patterns.
- Shadcn Admin (satnaing): MIT, Vite-based; only the shell layout pattern
  was taken, rebuilt for Next.js App Router.
- Shadboard: MIT, free, no premium tier; only the calendar and kanban
  layout patterns were taken. The kanban here uses accessible move
  controls; drag can be layered later with the already installed dnd-kit.
- Motion (framer-motion lineage): MIT core; Motion+ is paid and was NOT
  used. The installed framer-motion package is the import used here.
- Thinking Orbs: MIT. The orb here is an original DOM and motion
  reimplementation of the dotted-orb idea, recolored to spring; no
  upstream source was copied. Upstream reports six to nine states across
  versions; this folder implements six named agent states.
- React Bits: MIT plus Commons Clause (use in a product is allowed; the
  components themselves may not be sold or redistributed as a library).
  Spotlight, bento, and word-blur pieces here are original Bahar
  implementations of the patterns, not copied source, and are used only
  inside the Bahar product.
- Magic UI: free components MIT; Pro sections and templates are paid and
  were NOT used. Bento grid and number ticker here are original Bahar
  implementations of the free patterns.
- Kokonut UI: free components MIT; Pro is separate and was NOT used.
  Activity ring and magnetic call to action here are original Bahar
  implementations of the free patterns.
- Paid Persian templates (Vuexy, DashTail, Ecme, DashCode) and
  proprietary or Commons Clause-restricted kits (Aceternity, Orbkit,
  Canvas UI paid parts) were NOT used anywhere in this folder.
