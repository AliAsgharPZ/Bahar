import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit } from "@/lib/api";

/* ============================================================
   بهار | جزئیات جلسهٔ امتحان — چیدمان خودکار صندلی برای یک
   کلاس (ترتیب درهم با بذر ثابت جلسه)، فهرست مراقبین و نمای
   کامل صندلی‌ها بر اساس سالن
   ============================================================ */

type Ctx = { params: Promise<{ id: string }> };
const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

/** درهم‌ریزی قطعی با بذر — چیدمان هر جلسه پایدار و قابل چاپ مجدد است */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed >>> 0;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req, STAFF);
    const { id } = await ctx.params;
    const session = await db.examSession.findUnique({ where: { id } });
    if (!session) return apiErr(404, "جلسه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && me.schoolId !== session.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const [seats, invigilators] = await Promise.all([
      db.examSeat.findMany({
        where: { sessionId: id },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      }),
      db.examInvigilator.findMany({ where: { sessionId: id } }),
    ]);
    const teacherNames = new Map(
      (await db.user.findMany({ where: { id: { in: invigilators.map((i) => i.userId) } }, select: { id: true, firstName: true, lastName: true } }))
        .map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
    return apiOk({
      session,
      seats: seats
        .map((s) => ({
          room: s.room, seatNo: s.seatNo, studentId: s.studentId,
          studentName: `${s.student.user.firstName} ${s.student.user.lastName}`,
          className: s.student.class?.name ?? "",
        }))
        .sort((a, b) => a.room.localeCompare(b.room) || Number(a.seatNo) - Number(b.seatNo)),
      invigilators: invigilators.map((i) => ({ userId: i.userId, name: teacherNames.get(i.userId) ?? "—", room: i.room })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req, STAFF);
    const { id } = await ctx.params;
    const session = await db.examSession.findUnique({ where: { id } });
    if (!session) return apiErr(404, "جلسه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && me.schoolId !== session.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const body = await readJson<{ action?: string; classId?: string; rooms?: string[]; perRoom?: number; invigilators?: { userId: string; room: string }[] }>(req);

    if (body.action === "arrange") {
      const cls = await db.class.findFirst({ where: { id: String(body.classId ?? ""), schoolId: session.schoolId }, select: { id: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
      const students: { id: string }[] = await db.student.findMany({
        where: { classId: cls.id, status: "ACTIVE" },
        orderBy: { id: "asc" },
        select: { id: true },
      });
      if (!students.length) return apiErr(400, "این کلاس دانش‌آموز فعالی ندارد.", "EMPTY");
      const rooms = (body.rooms?.length ? body.rooms : ["سالن اصلی"]).map((r) => r.trim()).filter(Boolean).slice(0, 10);
      const perRoom = Math.min(200, Math.max(5, Math.round(body.perRoom ?? 30)));
      const seed = [...session.id].reduce((s, c) => s + c.charCodeAt(0), 0);
      const shuffled = seededShuffle(students, seed);
      // صندلی‌های قبلی همین کلاس در این جلسه پاک و از نو چیده می‌شوند
      await db.examSeat.deleteMany({ where: { sessionId: id, student: { classId: cls.id } } });
      await db.examSeat.createMany({
        data: shuffled.map((s, i) => ({
          sessionId: id,
          studentId: s.id,
          room: rooms[Math.min(rooms.length - 1, Math.floor(i / perRoom))],
          seatNo: String((i % perRoom) + 1),
        })),
      });
      await audit({ user: me, action: "چیدمان صندلی امتحان", entityType: "ExamSession", entityId: id, schoolId: session.schoolId });
      return apiOk({ arranged: shuffled.length, rooms: rooms.length });
    }

    if (body.action === "invigilators") {
      const list = (body.invigilators ?? []).slice(0, 40);
      const validUsers = new Set(
        (await db.user.findMany({
          where: { id: { in: list.map((x) => x.userId) }, schoolId: session.schoolId, role: { in: ["TEACHER", "MANAGER", "DEPUTY", "CUSTODIAN"] } },
          select: { id: true },
        })).map((u) => u.id),
      );
      await db.examInvigilator.deleteMany({ where: { sessionId: id } });
      const seen = new Set<string>();
      const rows = list
        .filter((x) => validUsers.has(x.userId))
        .map((x) => ({ sessionId: id, userId: x.userId, room: (x.room ?? "سالن اصلی").trim() || "سالن اصلی" }))
        .filter((x) => {
          const k = `${x.userId}|${x.room}`;
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
      if (rows.length) await db.examInvigilator.createMany({ data: rows });
      return apiOk({ invigilators: rows.length });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const { id } = await ctx.params;
    const session = await db.examSession.findUnique({ where: { id }, select: { schoolId: true } });
    if (!session) return apiErr(404, "جلسه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && me.schoolId !== session.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.examSession.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
