import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | عملیات امتحانات حضوری — ساخت جلسهٔ امتحان، چیدمان
   صندلی خودکار (درهم‌ریخته برای جلوگیری از تقلب)، تعیین
   مراقب و کارت ورود به جلسه برای دانش‌آموز
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);

    if (me.role === "STUDENT" || me.role === "PARENT") {
      const studentIds = me.role === "STUDENT"
        ? [(await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id].filter(Boolean) as string[]
        : (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
      const seats = await db.examSeat.findMany({
        where: { studentId: { in: studentIds } },
        include: { session: true, student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
        orderBy: { session: { startsAt: "asc" } },
      });
      return apiOk({
        mine: seats.map((s) => ({
          session: { id: s.session.id, title: s.session.title, subjectName: s.session.subjectName, startsAt: s.session.startsAt, durationMin: s.session.durationMin },
          room: s.room, seatNo: s.seatNo,
          studentName: `${s.student.user.firstName} ${s.student.user.lastName}`,
          className: s.student.class?.name ?? "",
        })),
      });
    }

    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const sessions = await db.examSession.findMany({
      where: { schoolId },
      include: { _count: { select: { seats: true, invigilators: true } } },
      orderBy: { startsAt: "desc" },
      take: 100,
    });
    return apiOk({ sessions });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ title?: string; subjectName?: string; startsAt?: string; durationMin?: number }>(req);
    const title = (body.title ?? "").trim();
    const startsAt = new Date(body.startsAt ?? "");
    if (title.length < 2 || isNaN(startsAt.getTime())) return apiErr(400, "عنوان و زمان امتحان الزامی است.", "BAD_INPUT");
    const session = await db.examSession.create({
      data: {
        schoolId, title, subjectName: body.subjectName?.trim() || null,
        startsAt, durationMin: Math.min(480, Math.max(15, Math.round(body.durationMin ?? 90))),
        createdById: me.id,
      },
    });
    await audit({ user: me, action: "ساخت جلسه امتحان", entityType: "ExamSession", entityId: session.id, schoolId });
    return apiOk({ session });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.examSession.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "جلسه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.examSession.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
