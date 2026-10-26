import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";
import { jalaliDayOfWeek } from "@/lib/persian";

/* ============================================================
   بهار | جایگزینی معلم غایب — برای یک روز مشخص: معلم‌هایی که
   مرخصیِ تأییدشده دارند، زنگ‌هایشان در برنامهٔ هفتگی، و برای هر
   زنگ نامزدهای آزاد (بدون کلاس در همان زنگ و بدون مرخصی) با
   اولویت هم‌درس بودن.
   GET /api/substitutions?date=YYYY-MM-DD
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const dateParam = new URL(req.url).searchParams.get("date");
    const day = dateParam ? new Date(`${dateParam}T12:00:00`) : new Date();
    if (Number.isNaN(day.getTime())) return apiErr(400, "تاریخ نامعتبر است.", "BAD_DATE");
    const start = new Date(day); start.setHours(0, 0, 0, 0);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const dow = jalaliDayOfWeek(day);

    // مرخصی‌های تأییدشده‌ای که این روز را پوشش می‌دهند
    const leaves = await db.leaveRequest.findMany({
      where: { schoolId, status: "APPROVED", fromDate: { lt: end }, toDate: { gte: start } },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    const absentIds = [...new Set(leaves.map((l) => l.userId))];

    // زنگ‌های امروزِ غایب‌ها
    const slots = absentIds.length
      ? await db.scheduleSlot.findMany({
          where: { teacherId: { in: absentIds }, dayOfWeek: dow, class: { schoolId } },
          orderBy: [{ period: "asc" }],
          include: {
            class: { select: { name: true } },
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
          },
        })
      : [];

    // همهٔ معلم‌های فعال مدرسه + زنگ‌های اشغالشان در همان روز + درس‌هایشان
    const teachers = await db.user.findMany({
      where: { schoolId, role: "TEACHER", isActive: true, id: { notIn: absentIds } },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    });
    const teacherIds = teachers.map((t) => t.id);
    const [busySlots, assignments] = await Promise.all([
      teacherIds.length
        ? db.scheduleSlot.findMany({ where: { teacherId: { in: teacherIds }, dayOfWeek: dow }, select: { teacherId: true, period: true } })
        : Promise.resolve([] as Array<{ teacherId: string | null; period: number }>),
      teacherIds.length
        ? db.teachingAssignment.findMany({ where: { teacherId: { in: teacherIds } }, select: { teacherId: true, subjectId: true } })
        : Promise.resolve([] as Array<{ teacherId: string; subjectId: string }>),
    ]);
    const busy = new Set(busySlots.map((s) => `${s.teacherId}:${s.period}`));
    const teaches = new Map<string, Set<string>>();
    for (const a of assignments) {
      const set = teaches.get(a.teacherId) ?? new Set<string>();
      set.add(a.subjectId);
      teaches.set(a.teacherId, set);
    }

    const byTeacher = new Map<string, { teacherId: string; teacherName: string; slots: unknown[] }>();
    for (const l of leaves) {
      if (!byTeacher.has(l.userId)) {
        byTeacher.set(l.userId, {
          teacherId: l.userId,
          teacherName: `${l.user.firstName} ${l.user.lastName}`,
          slots: [],
        });
      }
    }
    for (const s of slots) {
      if (!s.teacher) continue;
      const entry = byTeacher.get(s.teacher.id);
      if (!entry) continue;
      const candidates = teachers
        .filter((t) => !busy.has(`${t.id}:${s.period}`))
        .map((t) => ({
          id: t.id,
          name: `${t.firstName} ${t.lastName}`,
          sameSubject: s.subjectId ? (teaches.get(t.id)?.has(s.subjectId) ?? false) : false,
        }))
        .sort((a, b) => Number(b.sameSubject) - Number(a.sameSubject) || a.name.localeCompare(b.name, "fa"))
        .slice(0, 6);
      entry.slots.push({
        slotId: s.id,
        period: s.period,
        className: s.class.name,
        subjectName: s.subject?.name ?? "—",
        candidates,
      });
    }

    return apiOk({
      date: start.toISOString().slice(0, 10),
      dayOfWeek: dow,
      absences: [...byTeacher.values()],
    });
  } catch (e) {
    return handleApiError(e);
  }
}
