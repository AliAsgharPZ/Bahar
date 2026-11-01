/**
 * Bahar component barrel. Import from here or from the per-component
 * paths listed in AGENTS.md. Nothing in this folder is wired into any
 * page yet; landing is a separate follow-up step.
 */

export {
  BaharModal,
  BaharPage,
  BaharStagger,
  BaharStaggerItem,
  startSideOffset,
} from "@/components/bahar/motion/motion-primitives";
export {
  ThinkingOrbs,
  type OrbState,
} from "@/components/bahar/orbs/thinking-orbs";
export { StatCard, type StatTone } from "@/components/bahar/dashboard/stat-card";
export {
  BaharDataTable,
  type BaharColumn,
} from "@/components/bahar/dashboard/data-table";
export { MiniChart } from "@/components/bahar/dashboard/mini-chart";
export { AppShellPattern } from "@/components/bahar/dashboard/app-shell-pattern";
export {
  KanbanPattern,
  type KanbanCard,
  type KanbanColumn,
} from "@/components/bahar/dashboard/kanban-pattern";
export { SpotlightCard } from "@/components/bahar/landing/spotlight-card";
export {
  BentoCell,
  MagicBento,
} from "@/components/bahar/landing/magic-bento";
export { WordBlurText } from "@/components/bahar/landing/word-blur-text";
export { NumberTicker } from "@/components/bahar/landing/number-ticker";
export {
  ActivityRing,
  type ActivityRingItem,
} from "@/components/bahar/landing/activity-ring";
export { MagneticCta } from "@/components/bahar/landing/magnetic-cta";
export {
  faCurrency,
  faGrouped,
  faNumber,
  faPercent,
  jalaliToday,
} from "@/components/bahar/format";
