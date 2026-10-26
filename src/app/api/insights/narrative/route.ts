import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";
import { buildNarrative } from "@/lib/risk";
import { toKey, faDigits } from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";

// ============================================================
// بهار | API روایت تحلیلی — GET /api/insights/narrative?studentId=
// متن روایی فارسی از داده واقعی (نمره/حضور/رفتار/سلامت روان)
// بدون LLM خارجی — قطعه‌قطعه از آمار واقعی ساخته می‌شود
// دسترسی: MANAGER/DEPUTY/TEACHER/SUPER_ADMIN/ADMIN + خود دانش‌آموز/اولیا
// ============================================================

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    if (!studentId) return apiErr(400, "studentId الزامی است.", "BAD_INPUT");

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true, schoolId: true, classId: true,
        user: { select: { id: true, firstName: true, lastName: true } },
        class: { select: { name: true, grade: true } },
      },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    // دسترسی
    if (me.role === "STUDENT" || me.role === "PARENT") {
      if (me.role === "STUDENT" && student.user.id !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (me.role === "PARENT") {
        const link = await db.studentParent.findFirst({
          where: { studentId: student.id, parentUserId: me.id },
          select: { id: true },
        });
        if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
    } else if (me.role === "TEACHER" && student.classId) {
      const [teaches, homeroom] = await Promise.all([
        db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId: student.classId }, select: { id: true } }),
        db.class.findFirst({ where: { id: student.classId, homeroomTeacherId: me.id }, select: { id: true } }),
      ]);
      if (!teaches && !homeroom) return apiErr(403, "معلمِ این کلاس نیستید.", "FORBIDDEN");
    } else {
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
      if (student.schoolId !== schoolId) return apiErr(403, "این دانش‌آموز متعلق به مدرسه فعال نیست.", "FORBIDDEN");
    }

    const maxScore = getCountrySync().grading.maxScore;

    // ── نمرات نیمسال جاری ──
    const gradeRows = await db.gradeRecord.findMany({
      where: { studentId: student.id },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { score: true, maxScore: true, term: true, subjectId: true },
    });
    const latestTerm = gradeRows[0]?.term ?? 1;
    const termRows = gradeRows.filter((r) => r.term === latestTerm);
    const termAverage = termRows.length
      ? termRows.reduce((s, r) => s + (r.score / (r.maxScore || maxScore)) * maxScore, 0) / termRows.length
      : null;

    // بهترین/ضعیف‌ترین درس
    let bestSubject: { name: string; avg: number } | null = null;
    let worstSubject: { name: string; avg: number } | null = null;
    if (termRows.length) {
      const bySubject = new Map<string, { sum: number; n: number }>();
      for (const r of termRows) {
        const cur = bySubject.get(r.subjectId) ?? { sum: 0, n: 0 };
        cur.sum += (r.score / (r.maxScore || maxScore)) * maxScore;
        cur.n += 1;
        bySubject.set(r.subjectId, cur);
      }
      const subjectIds = Array.from(bySubject.keys());
      const subjects = await db.subject.findMany({
        where: { id: { in: subjectIds } },
        select: { id: true, name: true },
      });
      const nameOf = new Map<string, string>(subjects.map((s) => [s.id, s.name]));
      const avgs = Array.from(bySubject.entries())
        .map(([sid, v]) => ({ name: nameOf.get(sid) ?? "—", avg: v.sum / v.n }))
        .filter((x) => x.name !== "—");
      if (avgs.length >= 2) {
        avgs.sort((a, b) => b.avg - a.avg);
        bestSubject = avgs[0];
        worstSubject = avgs[avgs.length - 1];
      }
    }

    // ── حضور ۳۰ روز ──
    const keys30: string[] = [];
    for (let i = 0; i < 30; i += 1) keys30.push(toKey(new Date(Date.now() - i * 864e5)));
    const attRows = await db.attendance.findMany({
      where: { studentId: student.id, date: { in: keys30 }, period: 0 },
      select: { status: true },
    });
    const attendanceRate = attRows.length
      ? Math.round((attRows.filter((r) => r.status === "PRESENT").length / attRows.length) * 100)
      : null;
    const absentDays = attRows.length ? attRows.filter((r) => r.status === "ABSENT").length : null;
    const lateCount = attRows.length ? attRows.filter((r) => r.status === "LATE").length : null;

    // ── رفتار ۳۰ روز ──
    const monthAgo = new Date(Date.now() - 30 * 864e5);
    const behRows = await db.behaviorRecord.findMany({
      where: { studentId: student.id, createdAt: { gte: monthAgo } },
      select: { kind: true },
    });
    const behaviorPositive = behRows.length ? behRows.filter((r) => r.kind === "POSITIVE").length : null;
    const behaviorNegative = behRows.length ? behRows.filter((r) => r.kind === "NEGATIVE").length : null;

    // ── سلامت روان ۱۴ روز ──
    const keys14: string[] = keys30.slice(0, 14);
    const moodRows = await db.wellbeingCheckin.findMany({
      where: { studentId: student.id, date: { in: keys14 } },
      select: { mood: true },
    });
    const avgMood = moodRows.length ? moodRows.reduce((s, r) => s + r.mood, 0) / moodRows.length : null;

    // ── سطح ریسک (اگر رکورد دارد) ──
    const risk = await db.riskScore.findFirst({
      where: { studentId: student.id },
      orderBy: { computedAt: "desc" },
      select: { level: true },
    });

    const narrative = buildNarrative({
      studentName: `${student.user.firstName} ${student.user.lastName}`,
      gradeLevel: student.class?.grade ?? null,
      className: student.class?.name ?? null,
      termAverage,
      maxScore,
      bestSubject,
      worstSubject,
      attendanceRate,
      absentDays,
      lateCount,
      behaviorPositive,
      behaviorNegative,
      avgMood,
      riskLevel: risk?.level ?? null,
    });

    return apiOk({
      narrative,
      stats: {
        termAverage: termAverage != null ? Math.round(termAverage * 10) / 10 : null,
        maxScore,
        attendanceRate,
        absentDays,
        lateCount,
        behaviorPositive,
        behaviorNegative,
        avgMood: avgMood != null ? Math.round(avgMood * 10) / 10 : null,
        riskLevel: risk?.level ?? null,
        termLabel: faDigits(latestTerm),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
