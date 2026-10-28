import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, actingSchoolIdFor } from "@/lib/api";
import { todayKey, jalaliDayOfWeek, jalaliParts } from "@/lib/persian";

/* ============================================================
   بهار | تابلوی مدرسه (حالت تلویزیون) — دادهٔ یک‌جای نمایش
   لابی/کلاس: اطلاعیه‌های تازه، رویدادهای امروز و فردا،
   تولدهای امروز، غذای امروز و صدرنشین لیگ خانه‌ها.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let schoolId: string | null = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId && (me.role === "STUDENT" || me.role === "PARENT")) {
      if (me.role === "STUDENT") {
        schoolId = (await db.student.findUnique({ where: { userId: me.id }, select: { schoolId: true } }))?.schoolId ?? null;
      } else {
        const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, select: { student: { select: { schoolId: true } } } });
        schoolId = link?.student.schoolId ?? null;
      }
    }
    const school = schoolId ? await db.school.findUnique({ where: { id: schoolId }, select: { name: true } }) : null;
    if (!schoolId) return apiOk({ schoolName: "", announcements: [], events: [], birthdays: [], meal: null, topHouse: null, today: todayKey() });

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayEnd = new Date(dayStart.getTime() + 2 * 86400000);
    const { m: jm, d: jd } = jalaliParts(now);

    const [announcements, events, mealRows, birthdayUsers, houses, students, behaviors, badgeRows] = await Promise.all([
      db.announcement.findMany({
        where: { schoolId, scope: "SCHOOL" },
        select: { id: true, title: true, body: true, pinned: true, createdAt: true },
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 8,
      }),
      db.schoolEvent.findMany({
        where: { schoolId, startAt: { gte: dayStart, lt: dayEnd } },
        select: { id: true, title: true, startAt: true, kind: true },
        orderBy: { startAt: "asc" }, take: 10,
      }),
      db.mealPlan.findMany({ where: { schoolId, weekday: jalaliDayOfWeek(now) }, take: 1 }),
      db.user.findMany({
        where: { schoolId, isActive: true, role: { in: ["STUDENT", "TEACHER"] }, birthDate: { not: null } },
        select: { firstName: true, lastName: true, role: true, birthDate: true },
      }),
      db.house.findMany({ where: { schoolId }, select: { id: true, name: true, color: true } }),
      db.student.findMany({ where: { schoolId, status: "ACTIVE" }, select: { id: true, houseId: true } }),
      db.behaviorRecord.findMany({ where: { student: { schoolId } }, select: { studentId: true, points: true } }),
      db.studentBadge.findMany({ where: { student: { schoolId } }, select: { studentId: true, badge: { select: { points: true } } } }),
    ]);

    const birthdays = birthdayUsers
      .filter((u) => {
        if (!u.birthDate) return false;
        const p = jalaliParts(u.birthDate);
        return p.m === jm && p.d === jd;
      })
      .map((u) => ({ name: `${u.firstName} ${u.lastName}`, role: u.role }));

    const houseOf = new Map<string, string | null>(students.map((s) => [s.id, s.houseId]));
    const points = new Map<string, number>(houses.map((h) => [h.id, 0]));
    for (const b of behaviors) { const h = houseOf.get(b.studentId); if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.points); }
    for (const b of badgeRows) { const h = houseOf.get(b.studentId); if (h && points.has(h)) points.set(h, (points.get(h) ?? 0) + b.badge.points); }
    const topHouse = houses
      .map((h) => ({ name: h.name, color: h.color, points: points.get(h.id) ?? 0 }))
      .sort((a, b) => b.points - a.points)[0] ?? null;

    return apiOk({
      schoolName: school?.name ?? "",
      today: todayKey(),
      announcements,
      events,
      birthdays,
      meal: mealRows[0] ?? null,
      topHouse,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
