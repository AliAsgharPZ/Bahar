import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor, demoWriteBlock } from "@/lib/api";

/* ============================================================
   بهار | بستن سال تحصیلی و ارتقا — برای هر کلاسِ سال جاری یا
   کلاسِ مقصد سال بعد ساخته می‌شود و دانش‌آموزان فعال منتقل
   می‌شوند، یا کلاس «فارغ‌التحصیل» علامت می‌خورد و دانش‌آموزانش
   فارغ‌التحصیل + سابقهٔ فارغ‌التحصیلی می‌گیرند. هر برنامه در یک
   batch تراکنش جداگانه اجرا می‌شود (تا خرابی یک برنامه، برنامه‌های
   قبلی را خراب نکند) و نتیجهٔ هر برنامه جداگانه برمی‌گردد؛ فقط با نقش مدیر.
   ============================================================ */

type Plan = { fromClassId: string; toName?: string; toGrade?: string; graduate?: boolean };

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const classes = await db.class.findMany({
      where: { schoolId },
      include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      orderBy: [{ academicYear: "desc" }, { name: "asc" }],
    });
    const years = [...new Set(classes.map((c) => c.academicYear))];
    return apiOk({ classes, years });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ toYear?: string; plans?: Plan[] }>(req);
    const toYear = (body.toYear ?? "").trim();
    const plans = (body.plans ?? []).slice(0, 60);
    if (!toYear || !plans.length) return apiErr(400, "سال مقصد و برنامهٔ کلاس‌ها الزامی است.", "BAD_INPUT");

    const fromClasses = await db.class.findMany({
      where: { id: { in: plans.map((p) => p.fromClassId) }, schoolId },
      select: { id: true, name: true, grade: true, academicYear: true },
    });
    const fromMap = new Map<string, any>(fromClasses.map((c) => [c.id, c]));
    let moved = 0;
    let graduated = 0;
    let created = 0;
    // FIX: هر برنامه در batch خودش اجرا می‌شود و نتیجه‌اش جداگانه گزارش می‌شود —
    // خرابی یک برنامه، برنامه‌های قبلی را برنمی‌گرداند و در 500 گم نمی‌شود
    const results: Array<{ fromClassId: string; status: string; moved?: number; graduated?: number; createdClass?: boolean; reason?: string }> = [];
    for (const plan of plans) {
      const from = fromMap.get(plan.fromClassId);
      if (!from) { results.push({ fromClassId: plan.fromClassId, status: "skipped", reason: "کلاس مبدأ یافت نشد" }); continue; }
      if (from.academicYear === toYear) { results.push({ fromClassId: plan.fromClassId, status: "skipped", reason: "کلاس مبدأ همان سال مقصد است" }); continue; }
      const students = await db.student.findMany({
        where: { classId: from.id, status: "ACTIVE" },
        select: { id: true },
      });
      try {
        if (plan.graduate) {
          if (students.length) {
            await db.$transaction([
              db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { status: "GRADUATED" } }),
              ...students.map((s) =>
                db.alumniProfile.upsert({
                  where: { studentId: s.id },
                  create: { schoolId, studentId: s.id, graduationYear: toYear },
                  update: { graduationYear: toYear },
                }),
              ),
            ]);
            graduated += students.length;
          }
          results.push({ fromClassId: plan.fromClassId, status: "graduated", graduated: students.length });
          continue;
        }
        const name = (plan.toName ?? from.name).trim();
        const grade = (plan.toGrade ?? from.grade).trim();
        if (!name || !grade) { results.push({ fromClassId: plan.fromClassId, status: "skipped", reason: "نام یا پایهٔ مقصد خالی است" }); continue; }
        const existingTarget = await db.class.findFirst({ where: { schoolId, name, academicYear: toYear } });
        if (existingTarget) {
          if (students.length) {
            await db.$transaction([
              db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { classId: existingTarget.id } }),
            ]);
            moved += students.length;
          }
          results.push({ fromClassId: plan.fromClassId, status: "moved", moved: students.length });
        } else {
          const targetId = crypto.randomUUID();
          const ops: any[] = [db.class.create({ data: { id: targetId, schoolId, name, grade, academicYear: toYear } })];
          if (students.length) ops.push(db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { classId: targetId } }));
          await db.$transaction(ops);
          created++;
          moved += students.length;
          results.push({ fromClassId: plan.fromClassId, status: "moved", moved: students.length, createdClass: true });
        }
      } catch (e) {
        results.push({ fromClassId: plan.fromClassId, status: "failed", reason: e instanceof Error ? e.message.slice(0, 200) : "خطا" });
      }
    }

    await audit({ user: me, action: `بستن سال و ارتقا به ${toYear}`, entityType: "School", entityId: schoolId, schoolId });
    return apiOk({ moved, graduated, createdClasses: created, toYear, results });
  } catch (e) {
    return handleApiError(e);
  }
}
