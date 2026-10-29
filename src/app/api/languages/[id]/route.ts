// بهار | API مدیریت بسته زبان — فعال/غیرفعال/حذف + انتخاب زبان کاربر
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, ApiError, handleApiError, requireUser, readJson, audit, ipOf } from "@/lib/api";

/** تغییر وضعیت بسته (ACTIVE/DISABLED/DRAFT) یا انتخاب زبان کاربر */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(req);
    const { id } = await params;
    const body = await readJson<{ status?: string; action?: string }>(req);

    // انتخاب زبان ترجیحی خودِ کاربر (همه نقش‌ها) — id می‌تواند کد زبان یا "fa" باشد
    if (body.action === "set-my-language") {
      if (id === "fa" || body.status === "fa") {
        await db.user.update({ where: { id: me.id }, data: { langCode: null } });
        return apiOk({ langCode: null });
      }
      const target = await db.languagePack.findFirst({ where: { code: id, status: "ACTIVE" } });
      if (target) {
        await db.user.update({ where: { id: me.id }, data: { langCode: target.code } });
        return apiOk({ langCode: target.code });
      }
      // بستهٔ همراه سامانه هم انتخاب‌پذیر است (قبلاً ۴۰۴ می‌داد و ترجیح
      // کاربر برای زبان‌های shipped هرگز ذخیره نمی‌شد — باگ دیده‌شدن، راند ۳).
      const { shippedLangPack } = await import("@/lib/langs/shipped");
      const shipped = shippedLangPack(id);
      if (shipped) {
        await db.user.update({ where: { id: me.id }, data: { langCode: shipped.code } });
        return apiOk({ langCode: shipped.code });
      }
      throw new ApiError(404, "NOT_FOUND", "زبان فعال با این کد یافت نشد.");
    }

    if (me.role !== "SUPER_ADMIN") throw new ApiError(403, "ONLY_SUPER_ADMIN", "مدیریت بسته‌های زبان فقط برای مدیر کل سامانه ممکن است.");

    const pack = await db.languagePack.findUnique({ where: { id } });
    if (!pack) throw new ApiError(404, "NOT_FOUND", "بسته زبان یافت نشد.");

    const status = String(body.status || "");
    if (!["ACTIVE", "DISABLED", "DRAFT"].includes(status)) {
      throw new ApiError(400, "BAD_STATUS", "وضعیت نامعتبر است (ACTIVE/DISABLED/DRAFT).");
    }
    await db.languagePack.update({ where: { id }, data: { status } });
    await audit({
      user: me,
      action: `LANG_PACK_${status}`,
      entityType: "LanguagePack",
      entityId: id,
      meta: { code: pack.code, name: pack.name },
      ip: ipOf(req),
    });
    return apiOk({ id, status });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN"]);
    const { id } = await params;
    const pack = await db.languagePack.findUnique({ where: { id } });
    if (!pack) throw new ApiError(404, "NOT_FOUND", "بسته زبان یافت نشد.");

    // کاربرانی که این زبان را انتخاب کرده‌اند → بازگردانده به فارسی
    await db.user.updateMany({ where: { langCode: pack.code }, data: { langCode: null } });
    await db.languagePack.delete({ where: { id } });
    await audit({
      user: me,
      action: "LANG_PACK_DELETE",
      entityType: "LanguagePack",
      entityId: id,
      meta: { code: pack.code, name: pack.name },
      ip: ipOf(req),
    });
    return apiOk({ deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
