import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | برنامهٔ غذایی هفتگی — مدیر منوی هر روز هفته را
   (صبحانه/ناهار/میان‌وعده) یک بار تنظیم می‌کند؛ دانش‌آموز و
   ولی در یک نگاه کل هفته را می‌بینند.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let schoolId: string | null = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (me.role === "STUDENT") {
      schoolId = (await db.student.findUnique({ where: { userId: me.id }, select: { schoolId: true } }))?.schoolId ?? schoolId;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, select: { student: { select: { schoolId: true } } } });
      schoolId = link?.student.schoolId ?? schoolId;
    }
    if (!schoolId) return apiOk({ plan: [] });
    const rows = await db.mealPlan.findMany({ where: { schoolId }, orderBy: { weekday: "asc" } });
    const plan = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const r = rows.find((x) => x.weekday === weekday);
      return { weekday, breakfast: r?.breakfast ?? "", lunch: r?.lunch ?? "", snack: r?.snack ?? "" };
    });
    return apiOk({ plan });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ weekday?: number; breakfast?: string; lunch?: string; snack?: string }>(req);
    const weekday = Math.min(7, Math.max(1, Math.round(body.weekday ?? 0)));
    if (!weekday) return apiErr(400, "روز هفته نامعتبر است.", "BAD_DAY");
    const row = await db.mealPlan.upsert({
      where: { schoolId_weekday: { schoolId, weekday } },
      create: {
        schoolId, weekday,
        breakfast: (body.breakfast ?? "").trim().slice(0, 200),
        lunch: (body.lunch ?? "").trim().slice(0, 200),
        snack: (body.snack ?? "").trim().slice(0, 200),
      },
      update: {
        breakfast: (body.breakfast ?? "").trim().slice(0, 200),
        lunch: (body.lunch ?? "").trim().slice(0, 200),
        snack: (body.snack ?? "").trim().slice(0, 200),
      },
    });
    return apiOk({ row });
  } catch (e) {
    return handleApiError(e);
  }
}
