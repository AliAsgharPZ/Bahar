import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor } from "@/lib/api";
import { enDigits } from "@/lib/persian";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/profile-requests/[id] — تایید یا رد درخواست توسط بالادستی */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const body = await readJson<{ approve?: boolean; note?: string }>(req);
    if (body.approve === undefined) {
      throw new ApiError(400, "BAD_ACTION", "عملیات تایید/رد مشخص نیست.");
    }

    const request = await db.profileChangeRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, role: true, schoolId: true, firstName: true, lastName: true } } },
    });
    if (!request) throw new ApiError(404, "NOT_FOUND", "درخواست یافت نشد.");
    if (request.status !== "PENDING") {
      throw new ApiError(400, "ALREADY_REVIEWED", "این درخواست قبلا بررسی شده است.");
    }
    if (request.userId === me.id) {
      throw new ApiError(403, "SELF_REVIEW", "نمی‌توانید درخواست خودتان را تایید کنید.");
    }

    // ── اختیار بررسی ──
    const target = request.user;
    const isSchoolUser = ["DEPUTY", "TEACHER", "STUDENT", "PARENT"].includes(target.role);
    if (isSchoolUser) {
      const acting = actingSchoolIdFor(req, me) ?? undefined;
      const isManagerOfSchool = me.role === "MANAGER" && me.schoolId && target.schoolId === me.schoolId;
      const actingAdmin = (me.role === "ADMIN" && !!acting && acting === target.schoolId) || me.role === "SUPER_ADMIN";
      if (!isManagerOfSchool && !actingAdmin) {
        throw new ApiError(403, "FORBIDDEN", "بررسی این درخواست با مدیر همان مدرسه یا ادمین سامانه است.");
      }
    } else if (target.role === "MANAGER") {
      if (me.role !== "SUPER_ADMIN" && me.role !== "ADMIN") {
        throw new ApiError(403, "FORBIDDEN", "درخواست مدیران مدرسه را ادمین سرویس بررسی می‌کند.");
      }
    } else {
      throw new ApiError(403, "FORBIDDEN", "این درخواست قابل بررسی نیست.");
    }

    let changes: Record<string, { from: string | null; to: string }>;
    try { changes = JSON.parse(request.changes) as Record<string, { from: string | null; to: string }>; } catch { return apiErr(400, "دادهٔ درخواست تغییر خراب است.", "BAD_CHANGES"); }
    if (!changes || typeof changes !== "object") return apiErr(400, "دادهٔ درخواست تغییر خراب است.", "BAD_CHANGES");
    const fieldLabels: Record<string, string> = {
      firstName: "نام", lastName: "نام خانوادگی", fatherName: "نام پدر", gender: "جنسیت",
      birthPlace: "محل تولد", birthDate: "تاریخ تولد", phone: "موبایل", homePhone: "تلفن خانه",
      email: "ایمیل", address: "آدرس", postalCode: "کد پستی", shadNumber: "شماره شاد",
      education: "مدرک تحصیلی", fieldOfStudy: "رشته تحصیلی", jobTitle: "شغل", photoUrl: "تصویر",
    };

    if (body.approve === true) {
      const data: Record<string, unknown> = {};
      for (const [field, diff] of Object.entries(changes)) {
        const v = diff.to || null;
        // FIX (راند ۱۶): مقدارها مثل PATCH کاربر اعتبارسنجی می‌شوند — نه کورکورانه
        if (field === "birthDate" && v) {
          const d = new Date(String(v));
          if (isNaN(d.getTime())) {
            await db.profileChangeRequest.update({ where: { id }, data: { status: "REJECTED", reviewedById: me.id, reviewNote: "تاریخ تولد نامعتبر بود", reviewedAt: new Date() } });
            return apiErr(400, "تاریخ تولد درخواست نامعتبر است؛ درخواست رد شد.", "BAD_DATE");
          }
          data[field] = d;
          continue;
        }
        if (field === "gender" && v && !["MALE", "FEMALE"].includes(String(v))) {
          return apiErr(400, "مقدار جنسیت نامعتبر است.", "BAD_GENDER");
        }
        if ((field === "phone" || field === "homePhone") && v) {
          data[field] = enDigits(String(v)).trim().slice(0, 20);
          continue;
        }
        if (field === "shadNumber" && v) {
          data[field] = enDigits(String(v)).trim();
          continue;
        }
        if (field === "photoUrl" && v) {
          // فقط مسیر آپلود داخلی مجاز است — URL بیرونی (فیشینگ/ردیابی) نه
          if (!String(v).startsWith("/")) {
            return apiErr(400, "تصویر باید از آپلود داخلی سامانه باشد.", "BAD_PHOTO");
          }
          data[field] = String(v).slice(0, 300);
          continue;
        }
        if (field === "email" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v))) {
          return apiErr(400, "ایمیل نامعتبر است.", "BAD_EMAIL");
        }
        data[field] = v != null ? String(v).slice(0, 300) : null;
      }
      // FIX: ویرایش کاربر + وضعیت درخواست در یک batch — خرابیِ دومی، پروفایلِ تغییرکرده با درخواستِ PENDING نمی‌گذارد
      await db.$transaction([
        db.user.update({ where: { id: target.id }, data }),
        db.profileChangeRequest.update({
          where: { id },
          data: {
            status: body.approve ? "APPROVED" : "REJECTED",
            reviewedById: me.id,
            reviewNote: body.note ? String(body.note).slice(0, 300) : null,
            reviewedAt: new Date(),
          },
        }),
      ]);
      // (شاخهٔ رد، پایینِ همین بلوک با یک update تکی انجام می‌شود — در else جدا آمده است)
    } else {
      await db.profileChangeRequest.update({
        where: { id },
        data: {
          status: body.approve ? "APPROVED" : "REJECTED",
          reviewedById: me.id,
          reviewNote: body.note ? String(body.note).slice(0, 300) : null,
          reviewedAt: new Date(),
        },
      });
    }

    await audit({
      user: me, action: body.approve ? "APPROVE_PROFILE_CHANGE" : "REJECT_PROFILE_CHANGE",
      entityType: "PROFILE_CHANGE_REQUEST", entityId: id,
      meta: { user: `${target.firstName} ${target.lastName}`, fields: Object.keys(changes).map((f) => fieldLabels[f] ?? f) },
      schoolId: target.schoolId,
    });

    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/profile-requests/[id] — حذف درخواست تغییر مشخصات (ثبت‌کننده یا مدیر) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const row = await db.profileChangeRequest.findUnique({ where: { id }, select: { userId: true } });
    if (!row) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    if (row.userId !== me.id && !["MANAGER", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.profileChangeRequest.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
