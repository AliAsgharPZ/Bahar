import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | بستن سال تحصیلی و ارتقا — برای هر کلاسِ سال جاری یا
   کلاسِ مقصد سال بعد ساخته می‌شود و دانش‌آموزان فعال منتقل
   می‌شوند، یا کلاس «فارغ‌التحصیل» علامت می‌خورد و دانش‌آموزانش
   فارغ‌التحصیل + سابقهٔ فارغ‌التحصیلی می‌گیرند. همه‌چیز در یک
   تراکنش و فقط با نقش مدیر.
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
    const fromMap = new Map(fromClasses.map((c) => [c.id, c]));
    let moved = 0;
    let graduated = 0;
    let created = 0;

    await db.$transaction(async (tx) => {
      for (const plan of plans) {
        const from = fromMap.get(plan.fromClassId);
        if (!from || from.academicYear === toYear) continue;
        const students = await tx.student.findMany({
          where: { classId: from.id, status: "ACTIVE" },
          select: { id: true },
        });
        if (plan.graduate) {
          if (students.length) {
            await tx.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { status: "GRADUATED" } });
            for (const s of students) {
              await tx.alumniProfile.upsert({
                where: { studentId: s.id },
                create: { schoolId, studentId: s.id, graduationYear: toYear },
                update: { graduationYear: toYear },
              });
            }
            graduated += students.length;
          }
          continue;
        }
        const name = (plan.toName ?? from.name).trim();
        const grade = (plan.toGrade ?? from.grade).trim();
        if (!name || !grade) continue;
        let target = await tx.class.findFirst({ where: { schoolId, name, academicYear: toYear } });
        if (!target) {
          target = await tx.class.create({ data: { schoolId, name, grade, academicYear: toYear } });
          created++;
        }
        if (students.length) {
          await tx.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { classId: target.id } });
          moved += students.length;
        }
      }
    });

    await audit({ user: me, action: `بستن سال و ارتقا به ${toYear}`, entityType: "School", entityId: schoolId, schoolId });
    return apiOk({ moved, graduated, createdClasses: created, toYear });
  } catch (e) {
    return handleApiError(e);
  }
}
