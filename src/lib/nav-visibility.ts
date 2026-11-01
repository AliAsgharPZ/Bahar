import type { NavItem } from "./nav";

// ============================================================
// بهار | دیده‌شدن تب‌ها بدون بستر مدرسه
// کاربری که به هیچ مدرسه‌ای متصل نیست (ادمین سرویس بدون پنل فعال،
// یا دانش‌آموز/ولیِ بی‌مدرسه) فقط همین تب‌ها را می‌بیند؛ بقیهٔ تب‌ها
// اصلاً نمایش داده نمی‌شوند و دسترسی مستقیم به آدرس‌شان هم با
// کارت «دسترسی ندارید» در AppShell بسته می‌شود. بقیهٔ تب‌ها همه
// به یک مدرسه مربوط‌اند و بدون آن معنا ندارند.
// ============================================================

export const NO_SCHOOL_OK: ReadonlySet<string> = new Set([
  "/app",
  "/app/schools",
  "/app/users",
  "/app/network",
  "/app/countries",
  "/app/languages",
  "/app/labs",
  "/app/plugins",
  "/app/reports",
  "/app/imports",
  "/app/approvals",
  "/app/audit",
  "/app/settings",
  "/app/blog",
  "/app/messages",
  "/app/tickets",
  "/app/profile",
  "/app/accessibility",
  "/app/children",
]);

/** فیلتر بستر مدرسه روی فهرستِ ازپیش فیلترشدهٔ نقش/دسترسی. */
export function applySchoolContext(items: NavItem[], hasSchoolContext: boolean): NavItem[] {
  if (hasSchoolContext) return items;
  return items.filter((n) => NO_SCHOOL_OK.has(n.href));
}
