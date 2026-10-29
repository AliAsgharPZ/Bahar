<!-- vibefarsi:rules:start -->
## VibeFarsi rules for this project

This product is for Persian (Farsi) speakers in Iran. Apply these on every
file you touch, without being reminded. Full guides: `docs/agents-md-persian.md`
(Persian / RTL) and `docs/ui-craft-rules.md` (craft, done checklist).

### Persian and RTL
- All user-facing text is Persian: labels, placeholders, errors, empty states,
  toasts, `aria-label`, titles, metadata. Identifiers, props, file names and
  commit messages stay English. Never «Oops», «Submit», «Loading».
- ZWNJ (نیم‌فاصله) in compounds (می‌شود، ثبت‌نام), Persian ی and ک, «گیومه»,
  «،» and «؟». One register per screen; never «می‌باشد».
- `<html lang="fa" dir="rtl">` once. Logical Tailwind only: `ms-`/`me-`,
  `ps-`/`pe-`, `start-`/`end-`, `text-start`, `border-s`, `gap-*`.
  Never `ml-`, `pl-`, `left-`, `text-left`, `space-x-*`, `flex-row-reverse`.
- "Next" arrows point left (`ArrowLeft`); drawers open from the start edge.
- Font is Vazirmatn via `--font-sans`. `letter-spacing: 0`; no `tracking-*`,
  no `uppercase`. Body ~16px / line-height 1.8, headings ~1.2.
- Visible digits are Persian ۰–۹ (`fa()` from `lib/utils`); values, URLs and
  payloads keep Latin digits. Thousands «٬», decimal «٫», «٪» after the number.
  Money «۱۲٬۴۵۰٬۰۰۰ تومان», unit after the number; never «$», never mix تومان and ریال.
- Dates are Jalali in the UI (`lib/jalali`), week starts Saturday, Friday is
  the weekend; store UTC ISO 8601, zone `Asia/Tehran`.
- LTR only on phone, OTP, email, IBAN, card, URL and code fields (`dir="ltr"`
  on the control, label stays RTL). Label above the field; errors under it,
  specific: «شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.»
- Mobile 11 digits starting `09`; national ID 10 digits mod-11; IBAN `IR` +
  24 digits mod-97; card 16 digits Luhn; postal code 10 digits. Normalize
  Persian and Arabic-Indic digits before validating.
- Components come from VibeFarsi (`npx vibefarsi add <slug>`) into
  `components/ui`. Do not add shadcn or another LTR kit.

### Craft (design system first, screens second)
- Nothing outside the system: no arbitrary Tailwind values (`p-[13px]`,
  `text-[15px]`, `#hex`), no new colors, font sizes or radii. Colors only from
  tokens (`bg-background`, `text-muted-foreground`, `bg-brand`, `border-border`),
  radius from `--radius`. If a component exists, use it as is.
- Spacing and sizes are even numbers on a 4px grid. Touch targets ≥ 44px,
  including close «×», chevron and icon buttons.
- One type scale (≤ 6 sizes). Line-height by role, never ad hoc: body 1.8,
  headings ~1.2, buttons/labels ~1.5. Muted text is for meta only.
- Limited palette, one accent per section, from tokens.
- Icons only from `lucide-react`; `strokeWidth` matches the adjacent text
  weight (1.5 regular, 2 medium/semibold); size ≈ text em. No hand-drawn SVG.
- Zero layout shift: `aspect-ratio` on every image, min-height on every async
  block. Loading is a `Skeleton` shaped like the final content.
- Motion by name (cross-fade, stagger, rubber-band), 150–300ms, `transform` /
  `opacity` only, honors `prefers-reduced-motion`. Stagger important items
  first. Tooltip groups: first delayed, siblings instant.
- Mobile first: verify at 360–390px before reporting done. Content is real:
  no lorem ipsum, no placeholder images.
- A dev panel (ids, flags, state) renders only when
  `process.env.NODE_ENV !== "production"`.
- Asked to «make it prettier»? Name the specific technique you will apply,
  then apply it.

### Before you finish
- Grep the diff for `ml-|mr-|pl-|pr-|left-|right-|text-left|text-right|space-x|\[[0-9]+px\]|#[0-9a-fA-F]{3,6}`.
- Every visible number Persian, every date Jalali, every image sized.
- Read every new string aloud in Persian: would an Iranian product ship it?
<!-- vibefarsi:rules:end -->
