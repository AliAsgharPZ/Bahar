import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor , toDate } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

// ============================================================
// مالی — شهریه و عوارض دانش‌آموزان
// ============================================================

/** GET /api/finance — مدیر: همه اقلام مدرسه؛ دانش‌آموز/ولی: اقلام خودش */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    if (!school) throw new ApiError(404, "NOT_FOUND", "مدرسه یافت نشد.");

    const status = new URL(req.url).searchParams.get("status") ?? undefined;

    if (["MANAGER", "SUPER_ADMIN"].includes(me.role) || (me.role === "ADMIN" && acting) || (me.role === "DEPUTY" && hasPermission(me, "manage_finance"))) {
      const where: Record<string, unknown> = { schoolId };
      if (status) where.status = status;
      const fees = await db.studentFee.findMany({
        where,
        include: {
          student: {
            select: {
              id: true, studentNumber: true,
              user: { select: { firstName: true, lastName: true, nationalId: true } },
              class: { select: { name: true } },
            },
          },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        take: 500,
      });
      const summary = {
        unpaid: fees.filter((f) => f.status === "UNPAID").length,
        unpaidAmount: fees.filter((f) => f.status === "UNPAID").reduce((s, f) => s + f.amount, 0),
        paid: fees.filter((f) => f.status === "PAID").length,
        paidAmount: fees.filter((f) => f.status === "PAID").reduce((s, f) => s + f.amount, 0),
        waived: fees.filter((f) => f.status === "WAIVED").length,
      };
      return apiOk({ scope: "manager", fees, summary });
    }

    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
      if (!profile) throw new ApiError(404, "NOT_FOUND", "پرونده دانش‌آموزی یافت نشد.");
      const fees = await db.studentFee.findMany({ where: { studentId: profile.id, ...(status ? { status } : {}) }, orderBy: { dueDate: "asc" } });
      return apiOk({ scope: "student", fees });
    }

    if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const fees = await db.studentFee.findMany({
        where: { studentId: { in: kids.map((k) => k.studentId) }, ...(status ? { status } : {}) },
        include: { student: { select: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { dueDate: "asc" },
      });
      return apiOk({ scope: "parent", fees });
    }

    throw new ApiError(403, "FORBIDDEN", "دسترسی مالی ندارید.");
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/finance — ثبت قلم شهریه (تکی یا گروهی برای کل کلاس) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });
    if (!school) throw new ApiError(404, "NOT_FOUND", "مدرسه یافت نشد.");

    const canManage =
      me.role === "MANAGER" || me.role === "SUPER_ADMIN" ||
      (me.role === "ADMIN" && acting) ||
      (me.role === "DEPUTY" && hasPermission(me, "manage_finance"));
    if (!canManage) throw new ApiError(403, "FORBIDDEN", "ثبت شهریه برای شما مجاز نیست.");

    const body = await readJson<{ title?: string; amount?: number; dueDate?: string; classId?: string; studentId?: string; note?: string }>(req);
    const title = String(body.title ?? "").trim();
    const amount = Math.floor(Number(body.amount ?? 0));
    if (title.length < 2) throw new ApiError(400, "BAD_TITLE", "عنوان قلم مالی الزامی است.");
    if (!amount || amount < 1000 || amount > 5000000000) throw new ApiError(400, "BAD_AMOUNT", "مبلغ نامعتبر است.");
    const dueDate = body.dueDate ? toDate(body.dueDate) : null;
    if (body.dueDate && !dueDate) return apiErr(400, "تاریخ سرآمد نامعتبر است.", "BAD_DATE"); // FIX راند ۱۶

    let studentIds: string[] = [];
    if (body.studentId) {
      const st = await db.student.findUnique({ where: { id: String(body.studentId) }, select: { id: true, schoolId: true } });
      if (!st || st.schoolId !== schoolId) throw new ApiError(400, "BAD_STUDENT", "دانش‌آموز نامعتبر است.");
      studentIds = [st.id];
    } else if (body.classId) {
      const cls = await db.class.findUnique({ where: { id: String(body.classId) }, select: { id: true, schoolId: true } });
      if (!cls || cls.schoolId !== schoolId) throw new ApiError(400, "BAD_CLASS", "کلاس نامعتبر است.");
      const students = await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true } });
      studentIds = students.map((s) => s.id);
    } else {
      throw new ApiError(400, "BAD_TARGET", "دانش‌آموز یا کلاس هدف را انتخاب کنید.");
    }
    if (studentIds.length === 0) throw new ApiError(400, "EMPTY", "دانش‌آموزی برای اعمال یافت نشد.");

    await db.studentFee.createMany({
      data: studentIds.map((sid) => ({
        studentId: sid,
        schoolId,
        title,
        amount,
        dueDate,
        note: body.note ? String(body.note).slice(0, 300) : null,
        status: "UNPAID",
      })),
    });

    await audit({
      user: me, action: "CREATE_FEE", entityType: "FEE", schoolId,
      meta: { title, amount, count: studentIds.length },
    });
    return apiOk({ ok: true, created: studentIds.length });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/finance — تغییر وضعیت پرداخت (پرداخت‌شده/معاف) */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");

    const body = await readJson<{ id?: string; status?: string; note?: string; title?: string; amount?: number; dueDate?: string }>(req);
    const fee = await db.studentFee.findUnique({ where: { id: String(body.id ?? "") } });
    if (!fee || fee.schoolId !== schoolId) throw new ApiError(404, "NOT_FOUND", "قلم مالی یافت نشد.");

    const canManage =
      me.role === "MANAGER" || me.role === "SUPER_ADMIN" ||
      (me.role === "ADMIN" && acting) ||
      (me.role === "DEPUTY" && hasPermission(me, "manage_finance"));
    if (!canManage) throw new ApiError(403, "FORBIDDEN", "تغییر وضعیت پرداخت برای شما مجاز نیست.");

    // ── ویرایش مشخصات قلم مالی (عنوان/مبلغ/سرسید) — بدون تغییر وضعیت ──
    const data: Record<string, unknown> = {};
    if (body.title !== undefined) {
      const t = String(body.title).trim();
      if (t.length < 2) throw new ApiError(400, "BAD_TITLE", "عنوان قلم مالی کوتاه است.");
      data.title = t;
    }
    if (body.amount !== undefined) {
      const a = Math.floor(Number(body.amount));
      if (!Number.isFinite(a) || a < 1000 || a > 5_000_000_000) throw new ApiError(400, "BAD_AMOUNT", "مبلغ نامعتبر است (۱٬۰۰۰ تا ۵ میلیارد تومان).");
      data.amount = a;
    }
    if (body.dueDate !== undefined) {
      const d = body.dueDate ? new Date(String(body.dueDate)) : null;
      if (body.dueDate && isNaN(d!.getTime())) throw new ApiError(400, "BAD_DATE", "تاریخ سرسید نامعتبر است.");
      data.dueDate = d;
    }
    const isEdit = Object.keys(data).length > 0;
    if (isEdit) {
      await db.studentFee.update({ where: { id: fee.id }, data });
      await audit({ user: me, action: "UPDATE_FEE", entityType: "FEE", entityId: fee.id, schoolId, meta: { edited: Object.keys(data) } });
      return apiOk({ ok: true });
    }

    // ── تغییر وضعیت ──
    const status = String(body.status ?? "");
    if (!["UNPAID", "PAID", "WAIVED"].includes(status)) throw new ApiError(400, "BAD_STATUS", "وضعیت نامعتبر است.");

    await db.studentFee.update({
      where: { id: fee.id },
      data: { status, paidAt: status === "PAID" ? new Date() : null, note: body.note ? String(body.note).slice(0, 300) : fee.note },
    });
    await audit({ user: me, action: "UPDATE_FEE", entityType: "FEE", entityId: fee.id, schoolId, meta: { status } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/finance?id= — حذف قلم مالی */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const acting = actingSchoolIdFor(req, me);
    const schoolId = me.schoolId ?? (acting || null);
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای متصل نیستید.");

    const id = new URL(req.url).searchParams.get("id") ?? "";
    const fee = await db.studentFee.findUnique({ where: { id } });
    if (!fee || fee.schoolId !== schoolId) throw new ApiError(404, "NOT_FOUND", "قلم مالی یافت نشد.");

    const canManage =
      me.role === "MANAGER" || me.role === "SUPER_ADMIN" ||
      (me.role === "ADMIN" && acting) ||
      (me.role === "DEPUTY" && hasPermission(me, "manage_finance"));
    if (!canManage) throw new ApiError(403, "FORBIDDEN", "حذف قلم مالی برای شما مجاز نیست.");

    await db.studentFee.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_FEE", entityType: "FEE", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
