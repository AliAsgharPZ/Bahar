import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError } from "@/lib/api";
import { computeRisk, currentPeriod } from "@/lib/risk";
import { actingSchoolIdFor } from "@/lib/api";

// ============================================================
// بهار | API موتور هشدار زودهنگام — GET /api/insights
//   ?level=HIGH|MODERATE  → فیلتر سطح
//   ?studentId=…          → تفصیلی یک دانش‌آموز (محاسبه لحظه‌ای)
// بدون پارامتر → نمای مدرسه: شمار سطح‌ها + ۲۰ ریسک برتر دوره جاری
// دسترسی: MANAGER/DEPUTY/SUPER_ADMIN/ADMIN (مدرسه فعال)
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER"]);
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const levelFilter = url.searchParams.get("level");
    const period = url.searchParams.get("period") || currentPeriod();

    // ── تفصیلی یک دانش‌آموز ──
    if (studentId) {
      const student = await db.student.findUnique({
        where: { id: studentId },
        select: {
          id: true, schoolId: true, classId: true,
          user: { select: { firstName: true, lastName: true, isActive: true } },
          class: { select: { name: true, grade: true } },
        },
      });
      if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

      // دسترسی: خدماتی فقط مدرسه فعال؛ معلم فقط کلاس خودش
      const actingSchool = actingSchoolIdFor(req, me);
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? student.schoolId;
      const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
      if (!isService && student.schoolId !== schoolId) {
        return apiErr(403, "این دانش‌آموز متعلق به مدرسه شما نیست.", "FORBIDDEN");
      }
      if (me.role === "TEACHER" && student.classId) {
        const teaches = await db.teachingAssignment.findFirst({
          where: { teacherId: me.id, classId: student.classId },
          select: { id: true },
        });
        const homeroom = await db.class.findFirst({
          where: { id: student.classId, homeroomTeacherId: me.id },
          select: { id: true },
        });
        if (!teaches && !homeroom) return apiErr(403, "معلمِ این کلاس نیستید.", "FORBIDDEN");
      }

      const risk = await computeRisk(student.id);
      return apiOk({
        student: {
          id: student.id,
          name: `${student.user.firstName} ${student.user.lastName}`,
          className: student.class?.name ?? null,
          grade: student.class?.grade ?? null,
        },
        risk,
      });
    }

    // ── نمای مدرسه ──
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const where = {
      student: { schoolId, status: "ACTIVE" as const },
      period,
      ...(levelFilter ? { level: levelFilter } : {}),
    };

    const [counts, top] = await Promise.all([
      db.riskScore.groupBy({
        by: ["level"],
        where: { student: { schoolId, status: "ACTIVE" }, period },
        _count: { _all: true },
      }),
      db.riskScore.findMany({
        where,
        orderBy: { score: "desc" },
        take: 20,
        select: {
          score: true,
          level: true,
          breakdown: true,
          computedAt: true,
          student: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
              class: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    const levelCounts: Record<string, number> = { HIGH: 0, MODERATE: 0, LOW: 0 };
    for (const c of counts) levelCounts[c.level] = c._count._all;

    // دوره‌های موجود (روند ماهانه)
    const periods = await db.riskScore.groupBy({
      by: ["period"],
      where: { student: { schoolId } },
      _count: { _all: true },
      orderBy: { period: "desc" },
      take: 12,
    });

    return apiOk({
      period,
      levelCounts,
      periods: periods.map((p) => ({ period: p.period, count: p._count._all })),
      top: top.map((r) => ({
        studentId: r.student.id,
        name: `${r.student.user.firstName} ${r.student.user.lastName}`,
        className: r.student.class?.name ?? "—",
        score: r.score,
        level: r.level,
        computedAt: r.computedAt,
        factors: safeParse(r.breakdown),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return [];
  }
}
