import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser , toInt } from "@/lib/api";

/** GET /api/subjects — درس‌های مدرسه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role === "STUDENT" || me.role === "PARENT") {
      return apiErr(403, "برای شما تعریف نشده است.", "FORBIDDEN");
    }
    const schoolId = requireSchoolId(me);
    const subjects = await db.subject.findMany({
      where: { schoolId },
      include: { _count: { select: { teachingAssignments: true } } },
      orderBy: { name: "asc" },
    });
    return apiOk({ subjects });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/subjects */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_subjects");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, string | number | undefined>>(req);
    const name = String(body.name ?? "").trim();
    if (name.length < 2) return apiErr(400, "نام درس الزامی است.", "BAD_NAME");
    const dupe = await db.subject.findFirst({ where: { schoolId, name } });
    if (dupe) return apiErr(409, "این درس قبلاً ثبت شده است.", "DUPLICATE");

    const subject = await db.subject.create({
      data: {
        schoolId,
        name,
        code: body.code ? String(body.code) : null,
        grade: body.grade ? String(body.grade) : null,
        weeklyHours: body.weeklyHours ? toInt(body.weeklyHours, 0, 12) ?? 2 : 2, // FIX راند ۱۶
      },
    });
    await audit({ user: me, action: "CREATE_SUBJECT", entityType: "SUBJECT", entityId: subject.id, schoolId });
    return apiOk({ subject });
  } catch (e) {
    return handleApiError(e);
  }
}
