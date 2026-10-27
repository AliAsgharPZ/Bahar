import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | کتاب سال دیجیتال — سال تحصیلی در یک نگاهِ قابل چاپ:
   آمار کلی، برترین‌های هر کلاس (میانگین نمره)، پُرخوان‌ترین
   کتاب‌ها، پرافتخارترین‌ها و قهرمان لیگ خانه‌ها.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let schoolId: string | null = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId && me.role === "STUDENT") {
      schoolId = (await db.student.findUnique({ where: { userId: me.id }, select: { schoolId: true } }))?.schoolId ?? null;
    }
    if (!schoolId && me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, select: { student: { select: { schoolId: true } } } });
      schoolId = link?.student.schoolId ?? null;
    }
    if (!schoolId) return apiOk({ yearbook: null });
    const school = await db.school.findUnique({ where: { id: schoolId }, select: { name: true } });

    const [studentsCount, staffCount, classes, certificatesCount, eventsCount, loans, grades, badgesByStudent, houses, students, behaviors, badgeRows] = await Promise.all([
      db.student.count({ where: { schoolId, status: "ACTIVE" } }),
      db.user.count({ where: { schoolId, isActive: true, role: { in: ["TEACHER", "MANAGER", "DEPUTY"] } } }),
      db.class.findMany({ where: { schoolId }, select: { id: true, name: true } }),
      db.certificate.count({ where: { schoolId, revokedAt: null } }),
      db.schoolEvent.count({ where: { schoolId } }),
      db.bookLoan.findMany({
        where: { schoolId },
        select: { bookId: true, book: { select: { title: true } } },
      }),
      db.gradeRecord.findMany({
        where: { student: { schoolId }, locked: true },
        select: { studentId: true, score: true, maxScore: true, classId: true, student: { select: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      db.studentBadge.findMany({
        where: { student: { schoolId } },
        select: { studentId: true, student: { select: { user: { select: { firstName: true, lastName: true } } } } },
      }),
      db.house.findMany({ where: { schoolId }, select: { id: true, name: true, color: true } }),
      db.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, houseId: true } }),
      db.behaviorRecord.findMany({ where: { student: { schoolId } }, select: { studentId: true, points: true } }),
      db.studentBadge.findMany({ where: { student: { schoolId } }, select: { studentId: true, badge: { select: { points: true } } } }),
    ]);

    // برترین هر کلاس بر پایهٔ میانگین نمرات نهایی
    const byStudent = new Map<string, { name: string; classId: string | null; sum: number; n: number }>();
    for (const g of grades) {
      const cur = byStudent.get(g.studentId) ?? { name: `${g.student.user.firstName} ${g.student.user.lastName}`, classId: g.classId, sum: 0, n: 0 };
      cur.sum += (g.score / Math.max(1, g.maxScore)) * 20;
      cur.n += 1;
      byStudent.set(g.studentId, cur);
    }
    const className = new Map(classes.map((c) => [c.id, c.name]));
    const topByClass = new Map<string, { name: string; avg: number }>();
    for (const v of byStudent.values()) {
      if (!v.classId || !v.n) continue;
      const avg = Math.round((v.sum / v.n) * 100) / 100;
      const cur = topByClass.get(v.classId);
      if (!cur || avg > cur.avg) topByClass.set(v.classId, { name: v.name, avg });
    }

    // پُرخوان‌ترین کتاب‌ها
    const bookCounts = new Map<string, { title: string; n: number }>();
    for (const l of loans) {
      const cur = bookCounts.get(l.bookId) ?? { title: l.book.title, n: 0 };
      cur.n += 1;
      bookCounts.set(l.bookId, cur);
    }
    const topBooks = [...bookCounts.values()].sort((a, b) => b.n - a.n).slice(0, 5);

    // پرافتخارترین‌ها (بیشترین نشان)
    const badgeCounts = new Map<string, { name: string; n: number }>();
    for (const b of badgesByStudent) {
      const cur = badgeCounts.get(b.studentId) ?? { name: `${b.student.user.firstName} ${b.student.user.lastName}`, n: 0 };
      cur.n += 1;
      badgeCounts.set(b.studentId, cur);
    }
    const mostBadges = [...badgeCounts.values()].sort((a, b) => b.n - a.n).slice(0, 5);

    // قهرمان لیگ خانه‌ها
    const houseOf = new Map(students.map((s) => [s.id, s.houseId]));
    const points = new Map<string, number>(houses.map((h) => [h.id, 0]));
    for (const b of behaviors) { const h = houseOf.get(b.studentId); if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.points); }
    for (const b of badgeRows) { const h = houseOf.get(b.studentId); if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.badge.points); }
    const champion = houses.map((h) => ({ name: h.name, color: h.color, points: points.get(h.id) ?? 0 })).sort((a, b) => b.points - a.points)[0] ?? null;

    return apiOk({
      yearbook: {
        schoolName: school?.name ?? "",
        stats: {
          students: studentsCount, staff: staffCount, classes: classes.length,
          certificates: certificatesCount, events: eventsCount, loans: loans.length,
        },
        topByClass: [...topByClass.entries()].map(([cid, v]) => ({ className: className.get(cid) ?? "", ...v })),
        topBooks,
        mostBadges,
        champion,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
