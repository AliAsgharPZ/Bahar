import { PERMISSION_CATALOG } from "@/lib/roles";

/* ============================================================
   بهار | قرارداد افزونه (منتشرشده برای توسعه‌دهندگان)
   یک افزونه یک مانیفست JSON است؛ کد دلخواه در اپ اجرا نمی‌شود.
   هوک‌ها نقطه‌های اتصال اعلان‌شده‌اند و مجوزها دقیقاً زیرمجموعهٔ
   کاتالوگ مجوزهای سامانه‌اند — افزونه هرگز مجوزی بیش از مدرسهٔ
   نصب‌کننده ندارد.
   ============================================================ */

export const PLUGIN_HOOKS = [
  "student.created",
  "attendance.recorded",
  "grade.recorded",
  "announcement.published",
  "wallet.topup",
  "shop.sale",
  "dorm.assigned",
  "task.created",
] as const;

export type PluginManifest = {
  code: string;
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  permissions: string[];
  hooks: string[];
  entry?: string; // نشانی صفحهٔ بیرونی افزونه (اختیاری) — در iframe باز نمی‌شود، فقط لینک است
};

export function validatePluginManifest(raw: unknown): { manifest: PluginManifest | null; errors: string[] } {
  const errors: string[] = [];
  const m = raw as Record<string, unknown> | null;
  if (!m || typeof m !== "object") return { manifest: null, errors: ["مانیفست باید یک شیء JSON باشد."] };
  const code = typeof m.code === "string" ? m.code.trim() : "";
  if (!/^[a-z][a-z0-9-]{1,29}$/.test(code)) errors.push("«code» باید ۲ تا ۳۰ حرف کوچک/عدد/خط تیره باشد (مثل bahar-report).");
  const name = typeof m.name === "string" ? m.name.trim() : "";
  if (!name || name.length > 80) errors.push("«name» الزامی است (حداکثر ۸۰ نویسه).");
  const version = typeof m.version === "string" ? m.version.trim() : "";
  if (!/^\d+(\.\d+){0,3}$/.test(version)) errors.push("«version» باید عددی باشد (مثل 1.0.0).");
  const knownPerms = new Set<string>(PERMISSION_CATALOG.map((c) => c.key));
  const permissions = Array.isArray(m.permissions) ? m.permissions : null;
  if (!permissions) errors.push("«permissions» باید آرایه باشد.");
  else permissions.forEach((p) => { if (typeof p !== "string" || !knownPerms.has(p)) errors.push(`مجوز ناشناخته در مانیفست: «${String(p)}».`); });
  const hooks = Array.isArray(m.hooks) ? m.hooks : null;
  if (!hooks) errors.push("«hooks» باید آرایه باشد.");
  else hooks.forEach((h) => { if (typeof h !== "string" || !(PLUGIN_HOOKS as readonly string[]).includes(h)) errors.push(`هوک ناشناخته در مانیفست: «${String(h)}».`); });
  if (errors.length > 0) return { manifest: null, errors };
  return {
    manifest: {
      code, name, version,
      description: typeof m.description === "string" ? m.description.slice(0, 500) : undefined,
      homepage: typeof m.homepage === "string" ? m.homepage.slice(0, 200) : undefined,
      permissions: permissions as string[],
      hooks: hooks as string[],
      entry: typeof m.entry === "string" ? m.entry.slice(0, 300) : undefined,
    },
    errors,
  };
}
