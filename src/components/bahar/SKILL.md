# Bahar UI skill

Use this skill whenever you build or change Bahar UI. It makes the agent
default to the Bahar design language instead of any foreign kit default.

## When to use it

- Any new component, page section, dialog, card, table, chart, or landing
  block in Bahar.
- Any restyle of an existing page after the Meta design migration finishes.

## How to use it

1. Read `src/components/bahar/AGENTS.md` first. It is the machine-readable
   component list and the rule set.
2. Read `src/components/bahar/bahar-preset.json` for tokens, radii, sizes,
   and direction rules.
3. Prefer a component from `src/components/bahar/` over building a new one.
   If none fits, build the new piece inside `src/components/bahar/` with
   the same rules, and add it to the AGENTS.md index.
4. Reuse the existing `.b-` primitives (button, card, input, badge, pill
   tab, option) before inventing a new style.
5. Never wire a new component into a page in the same change that creates
   it while the Meta migration is running. Creation and landing are
   separate steps; the integration plan lists landing targets.

## Checklist (every diff must pass all of these)

- [ ] Colors come only from Bahar tokens, by name.
- [ ] Fonts are Vazirmatn and Arad (Manrope for Latin text only).
- [ ] Direction uses logical utilities only; directional motion mirrors.
- [ ] Buttons are pills; cards are 32 or 16 radius; inputs are height 44
      with radius 8; primary touch targets are at least 44.
- [ ] Reduced motion shows the static final state.
- [ ] Persian split-text animation is word level only.
- [ ] Numbers render in Persian digits, dates in Jalali, currency unit
      word after the number (use `format.ts`).
- [ ] Icons come from lucide-react only.
- [ ] No new dependency, no paid feature, no Pro component, no paid
      template, no school template edit, no language, country, or module
      file edit.

## Examples

```tsx
import { BaharPage } from "@/components/bahar/motion/motion-primitives";
import { StatCard } from "@/components/bahar/dashboard/stat-card";
import { ThinkingOrbs } from "@/components/bahar/orbs/thinking-orbs";
import { faCurrency } from "@/components/bahar/format";

export function DashboardIntro() {
  return (
    <BaharPage>
      <StatCard
        title="شهریه وصول‌شده"
        value={12840000}
        suffix="toman"
        delta={12}
        deltaLabel="نسبت به ماه پیش"
        spark={[4, 6, 5, 8, 9, 12, 11, 14]}
        tone="spring"
      />
      <ThinkingOrbs state="searching" label="در حال جستجو" />
    </BaharPage>
  );
}
```

Notes on the example: `StatCard` formats the value with Persian digits
and the currency unit word itself, so callers pass raw numbers. The orb
is a status indicator, not a spinner replacement for buttons; buttons
keep their own loading text.
