import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser , toInt } from "@/lib/api";

/** GET /api/classes — کلاس‌های مدرسه (با آمار) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role === "STUDENT" || me.role === "PARENT") {
      return apiErr(403, "برای شما تعریف نشده است.", "FORBIDDEN");
    }
    const schoolId = requireSchoolId(me);
    const classes = await db.class.findMany({
      where: { schoolId, isActive: true },
      include: {
        homeroomTeacher: { select: { id: true, firstName: true, lastName: true, nationalId: true } },
        _count: { select: { students: true, teachingAssignments: true, scheduleSlots: true } },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    });
    return apiOk({ classes });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/classes — ساخت کلاس */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_classes");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, string | number | undefined>>(req);

    const name = String(body.name ?? "").trim();
    const grade = String(body.grade ?? "").trim();
    const academicYear = String(body.academicYear ?? "1404-1405").trim();
    if (name.length < 2 || grade.length < 1) {
      return apiErr(400, "نام و پایه کلاس الزامی است.", "BAD_NAME");
    }
    const dupe = await db.class.findFirst({ where: { schoolId, name, academicYear } });
    if (dupe) return apiErr(409, "کلاسی با این نام در سال تحصیلی وجود دارد.", "DUPLICATE");

    const homeroomTeacherId = body.homeroomTeacherId ? String(body.homeroomTeacherId) : null;
    if (homeroomTeacherId) {
      const t = await db.user.findUnique({ where: { id: homeroomTeacherId } });
      if (!t || t.schoolId !== schoolId || t.role !== "TEACHER") {
        return apiErr(400, "معلم مشاور کلاس نامعتبر است.", "BAD_TEACHER");
      }
    }

    const cls = await db.class.create({
      data: {
        schoolId,
        name,
        grade,
        field: body.field ? String(body.field) : null,
        academicYear,
        capacity: body.capacity ? toInt(body.capacity, 1, 200) ?? 30 : 30, // FIX راند ۱۶
        roomNumber: body.roomNumber ? String(body.roomNumber) : null,
        homeroomTeacherId,
      },
    });
    await audit({ user: me, action: "CREATE_CLASS", entityType: "CLASS", entityId: cls.id, schoolId });
    return apiOk({ class: cls });
  } catch (e) {
    return handleApiError(e);
  }
}
