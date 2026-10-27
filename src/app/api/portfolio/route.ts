import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError } from "@/lib/api";

/* ============================================================
   بهار | پورتفولیو دیجیتال دانش‌آموز — همهٔ دستاوردهای پراکندهٔ
   سامانه (گواهینامه‌ها، نشان‌ها، خانه و امتیازش، بهترین
   آزمون‌ها، کتاب‌های خوانده‌شده، نرخ حضور و نقاط قوت توصیفی)
   در یک صفحهٔ افتخارِ قابل چاپ برای ارائه به مدرسه/دانشگاه
   بعدی جمع می‌شود.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const studentIdParam = new URL(req.url).searchParams.get("studentId") ?? "";
    let studentId = studentIdParam;
    if (me.role === "STUDENT") {
      studentId = (await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id ?? "";
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentId = studentIdParam && links.some((l) => l.studentId === studentIdParam) ? studentIdParam : (links[0]?.studentId ?? "");
    } else {
      const schoolId = me.schoolId ?? null;
      if (!studentId || !schoolId) return apiOk({ portfolio: null });
      const ok = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!ok) return apiOk({ portfolio: null });
    }
    if (!studentId) return apiOk({ portfolio: null });

    const student = await db.student.findUnique({
      where: { id: studentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true, grade: true } },
        house: { select: { name: true } },
      },
    });
    if (!student) return apiOk({ portfolio: null });
    const school = await db.school.findUnique({ where: { id: student.schoolId }, select: { name: true } });

    const [certificates, badges, quizAttempts, loans, attendance, descriptive] = await Promise.all([
      db.certificate.findMany({
        where: { studentId, revokedAt: null },
        select: { id: true, title: true, kind: true, issuedAt: true, serial: true },
        orderBy: { issuedAt: "desc" }, take: 20,
      }),
      db.studentBadge.findMany({
        where: { studentId },
        include: { badge: { select: { title: true, icon: true } } },
        orderBy: { awardedAt: "desc" }, take: 30,
      }),
      db.quizAttempt.findMany({
        where: { studentId, submittedAt: { not: null } },
        include: { quiz: { select: { title: true } } },
        orderBy: { score: "desc" }, take: 5,
      }),
      db.bookLoan.count({ where: { studentId, returnedAt: { not: null } } }),
      db.attendance.findMany({ where: { studentId, period: 0 }, select: { status: true } }),
      db.descriptiveGrade.findMany({ where: { studentId, level: "VERY_GOOD" }, select: { competency: true, term: true }, take: 8 }),
    ]);
    const present = attendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const attendanceRate = attendance.length ? Math.round((present / attendance.length) * 100) : null;

    return apiOk({
      portfolio: {
        student: {
          name: `${student.user.firstName} ${student.user.lastName}`,
          className: student.class?.name ?? "", grade: student.class?.grade ?? "",
          schoolName: school?.name ?? "", houseName: student.house?.name ?? null,
          studentNumber: student.studentNumber,
        },
        certificates,
        badges: badges.map((b) => ({ id: b.id, name: b.badge.title, icon: b.badge.icon, awardedAt: b.awardedAt })),
        topQuizzes: quizAttempts.map((a) => ({ title: a.quiz.title, score: a.score })),
        booksRead: loans,
        attendanceRate,
        strengths: descriptive.map((d) => d.competency),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
