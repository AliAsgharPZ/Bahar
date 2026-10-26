import { NextRequest } from "next/server";
import { requireUser, apiOk, apiErr, handleApiError, audit } from "@/lib/api";
import { db } from "@/lib/db";
import { validateCountryPack } from "@/lib/country/pack";
import { COUNTRY_PACK_MAX_BYTES } from "@/lib/country/types";
import { getSettings } from "@/lib/settings";

// ============================================================
// بهار | API بسته‌های کشور — لیست/بارگذاری (سوپرادمین)
// GET  /api/countries        → لیست بسته‌ها (عمومی: فقط خلاصه)
// POST /api/countries        → بارگذاری بسته جدید (SUPER_ADMIN، ?validate=1 خشک)
// ============================================================

export async function GET() {
  try {
    const packs = await db.countryPack.findMany({
      orderBy: [{ createdAt: "desc" }],
      select: { id: true, code: true, name: true, nativeName: true, status: true, version: true, notes: true, createdAt: true },
    });
    const settings = await getSettings();
    return apiOk({ packs, active: settings.countryPackCode || "IR" });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("validate") === "1";

    const raw = await req.text();
    if (raw.length > COUNTRY_PACK_MAX_BYTES) {
      return apiErr(413, `حجم بسته از سقف ${COUNTRY_PACK_MAX_BYTES / 1024}KB بیشتر است.`, "PACK_TOO_LARGE");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return apiErr(400, "JSON نامعتبر است — ساختار بسته کشور را بررسی کنید.", "BAD_JSON");
    }

    const { profile, validation } = validateCountryPack(parsed);
    if (dryRun) {
      return apiOk({ validation });
    }
    if (!profile) {
      return apiErr(400, (validation.errors[0] ?? "بسته نامعتبر است.") + ` (${validation.errors.length} خطا)`, "INVALID_PACK");
    }

    const existing = await db.countryPack.findUnique({ where: { code: profile.code } });
    if (existing) {
      // به‌روزرسانی بسته موجود (نسخه جدید همان کشور)
      const row = await db.countryPack.update({
        where: { code: profile.code },
        data: {
          name: profile.name,
          nativeName: profile.nativeName,
          notes: profile.notes ?? null,
          version: profile.version ?? "1.0.0",
          data: JSON.stringify(parsed),
        },
      });
      await audit({ user: me, action: "COUNTRY_PACK_UPDATE", entityType: "country", entityId: profile.code, meta: { stats: validation.stats } });
      return apiOk({ pack: { id: row.id, code: row.code, status: row.status }, validation });
    }

    const row = await db.countryPack.create({
      data: {
        code: profile.code,
        name: profile.name,
        nativeName: profile.nativeName,
        notes: profile.notes ?? null,
        version: profile.version ?? "1.0.0",
        data: JSON.stringify(parsed),
        createdBy: me.id,
      },
    });
    await audit({ user: me, action: "COUNTRY_PACK_CREATE", entityType: "country", entityId: profile.code, meta: { stats: validation.stats } });
    return apiOk({ pack: { id: row.id, code: row.code, status: row.status }, validation });
  } catch (e) {
    return handleApiError(e);
  }
}
