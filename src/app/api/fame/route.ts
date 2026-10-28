import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | دیوار افتخار و لیگ خانه‌ها — فید زندهٔ افتخارهای
   مدرسه (نشان‌ها، گواهینامه‌ها و بهترین‌های آزمون) کنار
   جدول لیگ خانه‌ها از امتیاز رفتار و نشان‌ها.
   همه‌چیز از داده‌های موجود سامانه ساخته می‌شود.
   ============================================================ */

type FeedItem = { kind: "BADGE" | "CERT" | "QUIZ"; title: string; studentName: string; at: Date };

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
    if (!schoolId) return apiOk({ feed: [], houses: [] });

    const [badges, certs, quizzes, houses, students] = await Promise.all([
      db.studentBadge.findMany({
        where: { student: { schoolId } },
        include: { badge: { select: { title: true, points: true } }, student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { awardedAt: "desc" }, take: 30,
      }),
      db.certificate.findMany({
        where: { schoolId, revokedAt: null },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { issuedAt: "desc" }, take: 20,
      }),
      db.quizAttempt.findMany({
        where: { student: { schoolId }, submittedAt: { not: null }, score: { gte: 90 } },
        include: { quiz: { select: { title: true } }, student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: { submittedAt: "desc" }, take: 15,
      }),
      db.house.findMany({ where: { schoolId }, select: { id: true, name: true, color: true, motto: true } }),
      db.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, houseId: true } }),
    ]);

    const feed: FeedItem[] = [
      ...badges.map((b) => ({
        kind: "BADGE" as const,
        title: `نشان «${b.badge.title}» گرفت`,
        studentName: `${b.student.user.firstName} ${b.student.user.lastName}`,
        at: b.awardedAt,
      })),
      ...certs.map((c) => ({
        kind: "CERT" as const,
        title: `گواهینامهٔ «${c.title}» گرفت`,
        studentName: `${c.student.user.firstName} ${c.student.user.lastName}`,
        at: c.issuedAt,
      })),
      ...quizzes.map((q) => ({
        kind: "QUIZ" as const,
        title: `در آزمون «${q.quiz.title}» نمرهٔ ${q.score} گرفت`,
        studentName: `${q.student.user.firstName} ${q.student.user.lastName}`,
        at: q.submittedAt as Date,
      })),
    ].sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 30);

    // لیگ خانه‌ها: مجموع امتیاز رفتار + امتیاز نشان‌های اعضای هر خانه
    const houseOf = new Map<string, string | null>(students.map((s) => [s.id, s.houseId]));
    const points = new Map<string, number>(houses.map((h) => [h.id, 0]));
    const memberCount = new Map<string, number>(houses.map((h) => [h.id, 0]));
    for (const s of students) if (s.houseId && memberCount.has(s.houseId)) memberCount.set(s.houseId, (memberCount.get(s.houseId) ?? 0) + 1);
    const behaviors = await db.behaviorRecord.findMany({
      where: { student: { schoolId } }, select: { studentId: true, points: true },
    });
    for (const b of behaviors) {
      const h = houseOf.get(b.studentId);
      if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.points);
    }
    const badgeRows = await db.studentBadge.findMany({
      where: { student: { schoolId } },
      select: { studentId: true, badge: { select: { points: true } } },
    });
    for (const b of badgeRows) {
      const h = houseOf.get(b.studentId);
      if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.badge.points);
    }

    const league = houses
      .map((h) => ({ ...h, points: points.get(h.id) ?? 0, members: memberCount.get(h.id) ?? 0 }))
      .sort((a, b) => b.points - a.points);

    return apiOk({ feed, houses: league });
  } catch (e) {
    return handleApiError(e);
  }
}
