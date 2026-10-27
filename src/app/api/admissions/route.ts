import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { hashPassword, generatePassword, isValidNationalId } from "@/lib/auth";

/* ============================================================
   بهار | قیف پذیرش و ثبت‌نام — لیدهای سایت مدرسه در یک
   pipeline: جدید ← تماس ← بازدید ← لیست انتظار ← پذیرفته ←
   ثبت‌نام‌شده؛ تبدیل پذیرفته‌شده به دانش‌آموز واقعی با یک
   کلیک (ساخت حساب + رکورد دانش‌آموزی + رمز موقت).
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];
export const PIPELINE = ["NEW", "CONTACTED", "TOUR", "WAITLIST", "ADMITTED", "ENROLLED", "ARCHIVED"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const leads = await db.schoolLead.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 300 });
    const counts: Record<string, number> = {};
    for (const s of [...PIPELINE, "REGISTERED"]) counts[s] = 0;
    for (const l of leads) counts[l.status] = (counts[l.status] ?? 0) + 1;
    return apiOk({ leads, counts });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      action?: string; id?: string; status?: string; note?: string;
      nationalId?: string; firstName?: string; lastName?: string; classId?: string;
    }>(req);
    const lead = await db.schoolLead.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!lead) return apiErr(404, "لید یافت نشد.", "NOT_FOUND");

    if (body.action === "status") {
      const status = String(body.status ?? "");
      if (![...PIPELINE, "REGISTERED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
      await db.schoolLead.update({ where: { id: lead.id }, data: { status, note: body.note?.trim().slice(0, 500) ?? lead.note } });
      await audit({ user: me, action: "تغییر مرحله پذیرش", entityType: "SchoolLead", entityId: lead.id, schoolId });
      return apiOk({ ok: true });
    }

    if (body.action === "convert") {
      if (lead.convertedStudentId) return apiErr(409, "این لید قبلاً به دانش‌آموز تبدیل شده است.", "ALREADY");
      const nationalId = String(body.nationalId ?? "").replace(/\D/g, "");
      if (!isValidNationalId(nationalId)) return apiErr(400, "کد ملی دانش‌آموز معتبر نیست.", "BAD_NID");
      const firstName = (body.firstName ?? "").trim();
      const lastName = (body.lastName ?? "").trim();
      if (firstName.length < 2 || lastName.length < 2) return apiErr(400, "نام و نام خانوادگی دانش‌آموز الزامی است.", "BAD_NAME");
      const cls = body.classId ? await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } }) : null;
      if (body.classId && !cls) return apiErr(404, "کلاس یافت نشد.", "NO_CLASS");
      const existing = await db.user.findUnique({ where: { nationalId }, select: { id: true } });
      if (existing) return apiErr(409, "کاربری با این کد ملی از قبل وجود دارد.", "DUP_USER");

      const tempPassword = generatePassword();
      const count = await db.student.count({ where: { schoolId } });
      const user = await db.user.create({
        data: {
          nationalId, firstName, lastName, role: "STUDENT", schoolId,
          phone: lead.phone || null,
          passwordHash: hashPassword(tempPassword), tempPassword, mustChangePassword: true,
        },
      });
      const student = await db.student.create({
        data: {
          userId: user.id, schoolId, classId: cls?.id ?? null,
          studentNumber: `${new Date().getFullYear() % 100}${String(count + 1).padStart(4, "0")}`,
        },
      });
      await db.schoolLead.update({ where: { id: lead.id }, data: { status: "ENROLLED", convertedStudentId: student.id } });
      await audit({ user: me, action: "تبدیل لید به دانش‌آموز", entityType: "Student", entityId: student.id, schoolId });
      return apiOk({ studentId: student.id, userId: user.id, tempPassword });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.schoolLead.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.schoolLead.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
