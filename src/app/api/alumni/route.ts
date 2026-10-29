import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor, demoWriteBlock} from "@/lib/api";

/* ============================================================
   بهار | فارغ‌التحصیلان — رجیستری دانش‌آموختگان و نتایج آنان
   (قبولی دانشگاه/رشته و…) برای پیگیری و افتخار مدرسه
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const graduates = await db.student.findMany({
      where: { schoolId, status: "GRADUATED" },
      include: {
        user: { select: { firstName: true, lastName: true, nationalId: true, phone: true } },
        class: { select: { name: true, grade: true } },
        alumniProfile: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 1000,
    });
    const withOutcome = graduates.filter((g) => g.alumniProfile?.university || g.alumniProfile?.outcome).length;
    return apiOk({ graduates, stats: { total: graduates.length, withOutcome } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      studentId?: string; graduationYear?: string; university?: string; field?: string;
      outcome?: string; phone?: string; note?: string;
    }>(req);
    const student = await db.student.findFirst({ where: { id: String(body.studentId ?? ""), schoolId } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const data = {
      graduationYear: body.graduationYear?.trim().slice(0, 10) || null,
      university: body.university?.trim().slice(0, 120) || null,
      field: body.field?.trim().slice(0, 120) || null,
      outcome: body.outcome?.trim().slice(0, 300) || null,
      phone: body.phone?.trim().slice(0, 20) || null,
      note: body.note?.trim().slice(0, 500) || null,
    };
    const profile = await db.alumniProfile.upsert({
      where: { studentId: student.id },
      create: { schoolId, studentId: student.id, ...data },
      update: data,
    });
    await audit({ user: me, action: "به‌روزرسانی پرونده فارغ‌التحصیل", entityType: "AlumniProfile", entityId: profile.id, schoolId });
    return apiOk({ profile });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.alumniProfile.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.alumniProfile.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
