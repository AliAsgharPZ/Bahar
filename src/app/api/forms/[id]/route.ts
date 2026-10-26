import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { parseFields } from "../route";

/* ============================================================
   بهار | جزئیات فرم — پاسخ‌ها برای مدیریت؛ ثبت/ویرایش پاسخ
   برای ولی (به‌ازای هر فرزند) و دانش‌آموز (برای خودش)
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const { id } = await ctx.params;
    const form = await db.schoolForm.findFirst({ where: { id, schoolId } });
    if (!form) return apiErr(404, "فرم یافت نشد.", "NOT_FOUND");
    const fields = parseFields(form.fields);

    if (STAFF.includes(me.role)) {
      const submissions = await db.formSubmission.findMany({
        where: { formId: form.id },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 1000,
      });
      return apiOk({
        staff: true,
        form: { ...form, fields },
        submissions: submissions.map((s) => ({ ...s, answers: JSON.parse(s.answers || "{}") as Record<string, string> })),
      });
    }

    const mine = await db.formSubmission.findMany({ where: { formId: form.id, userId: me.id } });
    return apiOk({
      staff: false,
      form: { ...form, fields },
      mine: mine.map((s) => ({ ...s, answers: JSON.parse(s.answers || "{}") as Record<string, string> })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const { id } = await ctx.params;
    const form = await db.schoolForm.findFirst({ where: { id, schoolId } });
    if (!form) return apiErr(404, "فرم یافت نشد.", "NOT_FOUND");
    if (form.status !== "OPEN") return apiErr(409, "این فرم بسته شده است.", "CLOSED");
    const body = await readJson<{ studentId?: string; answers?: Record<string, unknown> }>(req);

    // دانش‌آموز مربوط: برای ولی = فرزندش، برای دانش‌آموز = خودش
    let studentId: string | null = null;
    if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId: String(body.studentId ?? "") } });
      if (!link) return apiErr(403, "دانش‌آموز معتبر نیست.", "FORBIDDEN");
      studentId = link.studentId;
    } else if (me.role === "STUDENT") {
      const st = await db.student.findFirst({ where: { userId: me.id, schoolId }, select: { id: true, classId: true } });
      if (!st) return apiErr(404, "پرونده دانش‌آموزی یافت نشد.", "NOT_FOUND");
      if (form.classId && form.classId !== st.classId) return apiErr(403, "این فرم برای کلاس شما نیست.", "FORBIDDEN");
      studentId = st.id;
    } else {
      return apiErr(403, "ثبت پاسخ فقط برای ولی و دانش‌آموز است.", "FORBIDDEN");
    }
    if (form.audience === "PARENTS" && me.role !== "PARENT") return apiErr(403, "این فرم برای اولیاست.", "FORBIDDEN");
    if (form.audience === "STUDENTS" && me.role !== "STUDENT") return apiErr(403, "این فرم برای دانش‌آموزان است.", "FORBIDDEN");

    const fields = parseFields(form.fields);
    const raw = body.answers ?? {};
    const answers: Record<string, string> = {};
    for (const f of fields) {
      const v = raw[f.key];
      const s = v === true ? "بله" : v === false ? "خیر" : v == null ? "" : String(v).slice(0, 2000);
      if (f.required && !s) return apiErr(400, `فیلد «${f.label}» الزامی است.`, "REQUIRED");
      if (f.type === "select" && s && f.options?.length && !f.options.includes(s)) return apiErr(400, `مقدار فیلد «${f.label}» معتبر نیست.`, "BAD_OPTION");
      answers[f.key] = s;
    }

    const submission = await db.formSubmission.upsert({
      where: { formId_studentId: { formId: form.id, studentId } },
      create: { formId: form.id, studentId, userId: me.id, answers: JSON.stringify(answers) },
      update: { userId: me.id, answers: JSON.stringify(answers) },
    });
    await audit({ user: me, action: "ثبت پاسخ فرم", entityType: "FormSubmission", entityId: submission.id, schoolId });
    return apiOk({ submission });
  } catch (e) {
    return handleApiError(e);
  }
}
