import { NextRequest } from "next/server";
import { requireUser, apiOk, apiErr, handleApiError, audit, readJson } from "@/lib/api";
import { db } from "@/lib/db";
import { saveSettings, getSettings } from "@/lib/settings";
import { refreshCountryCache } from "@/lib/country/server";

// ============================================================
// بهار | API بسته کشور [id] — فعال‌سازی/غیرفعال‌سازی/حذف
// PATCH /api/countries/:id  { action: "activate" | "disable" | "delete" }
// فعال‌سازی: تنظیم countryPackCode + ACTIVE کردن بسته + تازه‌سازی کش
// ============================================================

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    const { id } = await ctx.params;
    const body = await readJson<{ action?: string }>(req);
    const action = body.action ?? "";

    const row = await db.countryPack.findUnique({ where: { id } });
    if (!row) return apiErr(404, "بسته کشور یافت نشد.", "NOT_FOUND");

    if (action === "activate") {
      await db.countryPack.updateMany({ where: { status: "ACTIVE" }, data: { status: "DISABLED" } });
      await db.countryPack.update({ where: { id }, data: { status: "ACTIVE" } });
      await saveSettings({ countryPackCode: row.code });
      await refreshCountryCache();
      await audit({ user: me, action: "COUNTRY_PACK_ACTIVATE", entityType: "country", entityId: row.code });
      return apiOk({ active: row.code });
    }

    if (action === "disable") {
      await db.countryPack.update({ where: { id }, data: { status: "DISABLED" } });
      const settings = await getSettings();
      if (settings.countryPackCode === row.code) {
        await saveSettings({ countryPackCode: "IR" });
      }
      await refreshCountryCache();
      await audit({ user: me, action: "COUNTRY_PACK_DISABLE", entityType: "country", entityId: row.code });
      return apiOk({ active: "IR" });
    }

    if (action === "delete") {
      const settings = await getSettings();
      await db.countryPack.delete({ where: { id } });
      if (settings.countryPackCode === row.code) {
        await saveSettings({ countryPackCode: "IR" });
      }
      await refreshCountryCache();
      await audit({ user: me, action: "COUNTRY_PACK_DELETE", entityType: "country", entityId: row.code });
      return apiOk({ active: "IR" });
    }

    return apiErr(400, "action نامعتبر است (activate | disable | delete).", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser(req, ["SUPER_ADMIN"]);
    const { id } = await ctx.params;
    const row = await db.countryPack.findUnique({ where: { id } });
    if (!row) return apiErr(404, "بسته کشور یافت نشد.", "NOT_FOUND");
    return apiOk({ pack: row });
  } catch (e) {
    return handleApiError(e);
  }
}
