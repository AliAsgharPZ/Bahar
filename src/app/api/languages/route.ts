// بهار | API بسته‌های زبان کاستوم — فهرست/ایجاد (آپلود JSON)
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, ApiError, handleApiError, requireUser, readJson, rateLimit, ipOf, demoWriteBlock} from "@/lib/api";
import { CATALOG_KEYS, validateLanguagePack, LANG_PACK_MAX_BYTES } from "@/lib/langs";
import { SHIPPED_LANG_PACKS } from "@/lib/langs/shipped";

export async function GET(req: NextRequest) {
  try {
    // FIX (راند ۱۸): GET عمومی شد تا صفحه ورود هم فهرست زبان‌های فعال را ببیند؛
    // فقط فیلدهای عمومی (کد/نام/جهت) برگردانده می‌شود، نه وضعیت داخلی بسته‌ها.
    let wantsFull = false;
    try {
      await requireUser(req);
      wantsFull = true;
    } catch {
      wantsFull = false;
    }

    const packs = await db.languagePack.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      select: {
        id: true, code: true, name: true, nativeName: true, direction: true,
        status: true, author: true, version: true, notes: true,
        keyCount: true, coverage: true, createdAt: true, updatedAt: true,
      },
    });

    // زبان‌های ACTIVE برای انتخاب کاربران — بسته‌های همراه سامانه (shipped)
    // + بسته‌های کاستوم فعالِ پایگاه داده. بدون این ترکیب، انتخاب‌گر زبان
    // فقط فارسی نشان می‌داد و ۱۱ بستهٔ همراه سامانه نامرئی بودند (باگ دیده‌شدن، راند ۳).
    const shippedSelectable = SHIPPED_LANG_PACKS.map((p) => ({ code: p.code, name: p.name, nativeName: p.nativeName, direction: p.direction, source: "shipped" as const }));
    const shippedCodes = new Set(shippedSelectable.map((p) => p.code));
    const selectable = [
      ...shippedSelectable,
      ...packs
        .filter((p) => p.status === "ACTIVE" && !shippedCodes.has(p.code))
        .map((p) => ({ code: p.code, name: p.name, nativeName: p.nativeName, direction: p.direction, source: "custom" as const })),
    ];

    if (!wantsFull) {
      // کاربر مهمان: فقط زبان‌های قابل انتخاب
      return apiOk({ selectable, catalogSize: CATALOG_KEYS.length });
    }

    return apiOk({
      packs,
      selectable,
      catalogSize: CATALOG_KEYS.length,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    if (!rateLimit(`lang-upload:${ipOf(req)}`, 10, 60_000)) throw new ApiError(429, "TOO_MANY_REQUESTS", "درخواست‌های زیاد — کمی صبر کنید.");

    // حجم بدنه — قبل از parse کامل
    const len = Number(req.headers.get("content-length") || 0);
    if (len > LANG_PACK_MAX_BYTES + 4 * 1024) throw new ApiError(413, "PACK_TOO_LARGE", "حجم بسته زبان بیش از حد مجاز (۴۰۰KB) است.");

    let body: Record<string, unknown>;
    try {
      body = await readJson(req);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "بدنه درخواست JSON نامعتبر است.");
    }

    // حالت اعتبارسنجی بدون ذخیره (?validate=1)
    const dryRun = req.nextUrl.searchParams.get("validate") === "1";
    const result = validateLanguagePack({
      code: body.code,
      name: body.name,
      nativeName: body.nativeName,
      direction: body.direction,
      author: body.author,
      version: body.version,
      notes: body.notes,
      strings: body.strings,
    });

    if (dryRun) {
      return apiOk({ valid: result.ok, ...result });
    }
    if (!result.ok) {
      throw new ApiError(422, "INVALID_PACK", `بسته زبان معتبر نیست — ${result.errors.join(" · ")}`);
    }

    const code = String(body.code).trim().toLowerCase();
    const stringsJson = JSON.stringify(body.strings as Record<string, string>);
    const existing = await db.languagePack.findUnique({ where: { code } });
    if (existing) {
      // به‌روزرسانی بسته موجود (replace)
      const pack = await db.languagePack.update({
        where: { code },
        data: {
          name: String(body.name).trim(),
          nativeName: String(body.nativeName).trim(),
          direction: body.direction === "ltr" ? "ltr" : "rtl",
          author: typeof body.author === "string" ? body.author.slice(0, 80) : null,
          version: typeof body.version === "string" && /^\d+(\.\d+){0,3}$/.test(body.version) ? body.version : "1.0.0",
          notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : null,
          data: stringsJson,
          keyCount: result.stats.keyCount,
          coverage: result.stats.coverage,
        },
      });
      return apiOk({ pack, replaced: true, warnings: result.warnings });
    }

    const pack = await db.languagePack.create({
      data: {
        code,
        name: String(body.name).trim(),
        nativeName: String(body.nativeName).trim(),
        direction: body.direction === "ltr" ? "ltr" : "rtl",
        author: typeof body.author === "string" ? body.author.slice(0, 80) : null,
        version: typeof body.version === "string" && /^\d+(\.\d+){0,3}$/.test(body.version) ? body.version : "1.0.0",
        notes: typeof body.notes === "string" ? body.notes.slice(0, 500) : null,
        data: stringsJson,
        keyCount: result.stats.keyCount,
        coverage: result.stats.coverage,
        status: "DRAFT",
        createdBy: me.id,
      },
    });
    return apiOk({ pack, warnings: result.warnings });
  } catch (e) {
    return handleApiError(e);
  }
}
