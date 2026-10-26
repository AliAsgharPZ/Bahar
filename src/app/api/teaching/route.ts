import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser } from "@/lib/api";

/** GET /api/teaching?classId=&teacherId= — تخصیص معلم به کلاس/درس */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role === "STUDENT" || me.role === "PARENT") {
      return apiErr(403, "برای شما تعریف نشده است.", "FORBIDDEN");
    }
    const schoolId = requireSchoolId(me);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId") ?? undefined;
    const teacherId = searchParams.get("teacherId") ?? undefined;

    const where: Record<string, unknown> = { schoolId };
    if (classId) where.classId = classId;
    if (teacherId) where.teacherId = teacherId;

    const assignments = await db.teachingAssignment.findMany({
      where,
      include: {
        teacher: { select: { id: true, firstName: true, lastName: true, nationalId: true } },
        class: { select: { id: true, name: true, grade: true, field: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { subject: { name: "asc" } }],
    });
    return apiOk({ assignments });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/teaching — تخصیص معلم به درسِ یک کلاس */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_schedule");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ teacherId?: string; classId?: string; subjectId?: string; academicYear?: string }>(req);

    const teacherId = String(body.teacherId ?? "");
    const classId = String(body.classId ?? "");
    const subjectId = String(body.subjectId ?? "");
    if (!teacherId || !classId || !subjectId) {
      return apiErr(400, "معلم، کلاس و درس را انتخاب کنید.", "BAD_INPUT");
    }
    const teacher = await db.user.findUnique({ where: { id: teacherId } });
    const cls = await db.class.findUnique({ where: { id: classId } });
    const subject = await db.subject.findUnique({ where: { id: subjectId } });
    if (!teacher || teacher.role !== "TEACHER" || teacher.schoolId !== schoolId) {
      return apiErr(400, "معلم نامعتبر است.", "BAD_TEACHER");
    }
    if (!cls || cls.schoolId !== schoolId) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
    if (!subject || subject.schoolId !== schoolId) return apiErr(400, "درس نامعتبر است.", "BAD_SUBJECT");

    const academicYear = String(body.academicYear ?? cls.academicYear);
    const dupe = await db.teachingAssignment.findFirst({
      where: { classId, subjectId, academicYear },
    });
    if (dupe) {
      // جایگزینی معلم درس
      await db.teachingAssignment.update({ where: { id: dupe.id }, data: { teacherId } });
      await audit({ user: me, action: "REASSIGN_TEACHER", entityType: "TEACHING", entityId: dupe.id, schoolId });
      return apiOk({ ok: true, replaced: true });
    }

    const assignment = await db.teachingAssignment.create({
      data: { schoolId, teacherId, classId, subjectId, academicYear },
    });
    await audit({ user: me, action: "CREATE_TEACHING", entityType: "TEACHING", entityId: assignment.id, schoolId });
    return apiOk({ assignment });
  } catch (e) {
    return handleApiError(e);
  }
}
