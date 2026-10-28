import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";
import { validatePluginManifest } from "@/lib/plugins/contract";

/* ============================================================
   بهار | بازارچهٔ افزونه — کاتالوگ، نصب مدرسه، اعتبارسنجی مانیفست
   - ثبت/ویرایش افزونه: فقط SUPER_ADMIN
   - نصب/حذف/فعال/غیرفعال برای مدرسه: مدیر/معاون/ادمین مدرسه
   - نصب، دسترسی تازه‌ای نمی‌سازد: افزونه با همان نقش/مجوز
     مدرسه کار می‌کند و کدش در اپ اجرا نمی‌شود.
   ============================================================ */

const SCHOOL_STAFF = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    const plugins = await db.plugin.findMany({ orderBy: { name: "asc" } });
    const installs = schoolId
      ? await db.pluginInstall.findMany({ where: { schoolId }, include: { plugin: true } })
      : [];
    return apiOk({ plugins, installs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{ action?: string; manifest?: unknown; id?: string; pluginId?: string }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;

    if (body.action === "submit") {
      // سندباکس توسعه‌دهنده: اعتبارسنجی خشک مانیفست، بدون ذخیره
      const { manifest, errors } = validatePluginManifest(body.manifest);
      return apiOk({ valid: errors.length === 0, manifest, errors });
    }
    if (body.action === "publish") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین می‌تواند افزونه منتشر کند.", "FORBIDDEN");
      const { manifest, errors } = validatePluginManifest(body.manifest);
      if (!manifest) return apiErr(400, errors[0] ?? "مانیفست نامعتبر است.", "INVALID_MANIFEST", { errors });
      const existing = await db.plugin.findUnique({ where: { code: manifest.code } });
      const data = { name: manifest.name, author: "", description: manifest.description ?? "", version: manifest.version, homepage: manifest.homepage ?? "", manifest: JSON.stringify(manifest), status: "ACTIVE" as const };
      const plugin = existing
        ? await db.plugin.update({ where: { code: manifest.code }, data })
        : await db.plugin.create({ data: { code: manifest.code, ...data, createdById: me.id } });
      return apiOk({ plugin });
    }
    if (body.action === "install" || body.action === "uninstall" || body.action === "toggle") {
      if (!SCHOOL_STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
      const plugin = await db.plugin.findFirst({ where: { id: String(body.pluginId ?? ""), status: "ACTIVE" } });
      if (!plugin) return apiErr(404, "افزونهٔ فعال یافت نشد.", "NOT_FOUND");
      if (body.action === "install") {
        const install = await db.pluginInstall.upsert({
          where: { pluginId_schoolId: { pluginId: plugin.id, schoolId } },
          create: { pluginId: plugin.id, schoolId, status: "ACTIVE", installedById: me.id },
          update: { status: "ACTIVE" },
        });
        return apiOk({ install });
      }
      if (body.action === "uninstall") {
        await db.pluginInstall.deleteMany({ where: { pluginId: plugin.id, schoolId } });
        return apiOk({ ok: true });
      }
      const current = await db.pluginInstall.findUnique({ where: { pluginId_schoolId: { pluginId: plugin.id, schoolId } } });
      if (!current) return apiErr(404, "این افزونه برای مدرسه نصب نشده است.", "NOT_FOUND");
      const updated = await db.pluginInstall.update({ where: { id: current.id }, data: { status: current.status === "ACTIVE" ? "DISABLED" : "ACTIVE" } });
      return apiOk({ install: updated });
    }
    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
