import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, requireSchoolId } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"];

/**
 * GET /api/attendance/repeat-absences?min=3 — دانش‌آموزان پرغیبت مدرسه برای پیگیری معاون:
 * چند غیبت، چند توجیه در انتظار، آخرین غیبت و این‌که ولی ثبت‌شده دارد یا نه.
 * خروجی مستقیم به ماژول توجیه و احضار وصل می‌شود.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const schoolId = requireSchoolId(me);
    const { searchParams } = new URL(req.url);
    const min = Math.min(20, Math.max(2, Math.floor(Number(searchParams.get("min") ?? "3")) || 3));

    const absences = await db.attendance.findMany({
      where: { status: "ABSENT", period: 0, student: { schoolId } },
      select: { studentId: true, date: true },
      take: 20000,
    });
    const byStudent = new Map<string, { total: number; lastDate: string }>();
    for (const a of absences) {
      const cur = byStudent.get(a.studentId) ?? { total: 0, lastDate: "" };
      cur.total += 1;
      if (a.date > cur.lastDate) cur.lastDate = a.date;
      byStudent.set(a.studentId, cur);
    }
    const ids = [...byStudent.entries()].filter(([, v]) => v.total >= min).map(([id]) => id);
    if (!ids.length) return apiOk({ rows: [] });

    const [students, pendingExcuses, links] = await Promise.all([
      db.student.findMany({
        where: { id: { in: ids } },
        include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
      }),
      db.absenceExcuse.findMany({ where: { studentId: { in: ids }, status: "PENDING" }, select: { studentId: true } }),
      db.studentParent.findMany({ where: { studentId: { in: ids } }, select: { studentId: true } }),
    ]);
    const pendingBy = new Map<string, number>();
    for (const e of pendingExcuses) pendingBy.set(e.studentId, (pendingBy.get(e.studentId) ?? 0) + 1);
    const hasParent = new Set(links.map((l) => l.studentId));
    const info = new Map(students.map((s) => [s.id, s]));
    const rows = ids
      .map((id) => {
        const s = info.get(id);
        const agg = byStudent.get(id)!;
        return {
          studentId: id,
          studentName: s ? `${s.user.firstName} ${s.user.lastName}` : "",
          className: s?.class?.name ?? "",
          total: agg.total,
          pendingExcuses: pendingBy.get(id) ?? 0,
          lastDate: agg.lastDate,
          hasParent: hasParent.has(id),
        };
      })
      .sort((a, b) => b.total - a.total || (a.lastDate < b.lastDate ? 1 : -1))
      .slice(0, 50);
    return apiOk({ rows });
  } catch (e) {
    return handleApiError(e);
  }
}
