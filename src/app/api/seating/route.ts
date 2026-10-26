import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | چیدمان صندلی کلاس — نقشهٔ نشستن دانش‌آموزان روی
   شبکهٔ ردیف×ستون؛ ذخیره برای هر کلاس، قابل چاپ
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const classId = new URL(req.url).searchParams.get("classId") ?? "";
    const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const [plan, students] = await Promise.all([
      db.seatingPlan.findUnique({ where: { classId } }),
      db.student.findMany({
        where: { classId, status: "ACTIVE" },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { lastName: "asc" } },
      }),
    ]);
    let layout: unknown = {};
    try { layout = plan ? JSON.parse(plan.layout) : {}; } catch { layout = {}; }
    return apiOk({
      class: cls,
      layout,
      students: students.map((s) => ({ id: s.id, name: `${s.user.firstName} ${s.user.lastName}` })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ classId?: string; layout?: unknown }>(req);
    const cls = await db.class.findFirst({ where: { id: String(body.classId ?? ""), schoolId }, select: { id: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const raw = JSON.stringify(body.layout ?? {});
    if (raw.length > 100_000) return apiErr(413, "چیدمان بیش از حد بزرگ است.", "TOO_LARGE");
    // اعتبارسنجی سبک: فقط شناسه‌های دانش‌آموزان همین کلاس در صندلی‌ها بمانند
    let layout: { cols?: number; seats?: Record<string, string> } = {};
    try { layout = JSON.parse(raw) as typeof layout; } catch { return apiErr(400, "چیدمان نامعتبر است.", "BAD_LAYOUT"); }
    const validIds = new Set(
      (await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true } })).map((s) => s.id),
    );
    const seats: Record<string, string> = {};
    for (const [pos, sid] of Object.entries(layout.seats ?? {})) {
      if (/^\d+-\d+$/.test(pos) && validIds.has(sid)) seats[pos] = sid;
    }
    const clean = { cols: Math.min(10, Math.max(1, Math.round(layout.cols ?? 5))), seats };
    const plan = await db.seatingPlan.upsert({
      where: { classId: cls.id },
      create: { schoolId, classId: cls.id, layout: JSON.stringify(clean), updatedById: me.id },
      update: { layout: JSON.stringify(clean), updatedById: me.id },
    });
    await audit({ user: me, action: "ذخیره چیدمان صندلی", entityType: "SeatingPlan", entityId: plan.id, schoolId });
    return apiOk({ plan: { ...plan, layout: clean } });
  } catch (e) {
    return handleApiError(e);
  }
}
