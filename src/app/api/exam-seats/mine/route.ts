import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError } from "@/lib/api";

/**
 * GET /api/exam-seats/mine — دانش‌آموز: کارت‌ها و شماره صندلی‌های خودش؛
 * ولی: کارت‌های فرزندانش. فقط خواندنی.
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let studentIds: string[] = [];
    if (me.role === "STUDENT") {
      const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (profile) studentIds = [profile.id];
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentIds = links.map((l) => l.studentId);
    } else {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    if (!studentIds.length) return apiOk({ cards: [], schoolName: "" });
    const rows = await db.examSeatAssignment.findMany({
      where: { studentId: { in: studentIds } },
      orderBy: [{ sessionNo: "asc" }, { seatNo: "asc" }],
      include: {
        plan: { select: { id: true, title: true, date: true, sessions: true, schoolId: true } },
        student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
      },
    });
    const school = rows.length ? await db.school.findUnique({ where: { id: rows[0].plan.schoolId }, select: { name: true } }) : null;
    return apiOk({
      schoolName: school?.name ?? "",
      cards: rows.map((a) => ({
        id: a.id,
        planId: a.plan.id,
        planTitle: a.plan.title,
        planDate: a.plan.date,
        sessionNo: a.sessionNo,
        roomName: a.roomName,
        seatNo: a.seatNo,
        studentId: a.studentId,
        studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
        studentNumber: a.student.studentNumber,
        className: a.student.class?.name ?? "",
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
