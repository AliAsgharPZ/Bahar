import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

/** GET /api/events?upcoming=1 — رویدادهای مدرسه بر اساس مخاطب */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const upcoming = searchParams.get("upcoming") === "1";
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const schoolId = isService ? searchParams.get("schoolId") ?? undefined : me.schoolId ?? undefined;
    if (!schoolId) return apiOk({ events: [] });

    const audiences = ["ALL"];
    if (me.role === "STUDENT") audiences.push("STUDENTS");
    if (me.role === "TEACHER" || me.role === "DEPUTY" || me.role === "MANAGER") audiences.push("TEACHERS");
    if (me.role === "PARENT") audiences.push("PARENTS");

    const where: Record<string, unknown> = { schoolId, audience: { in: audiences } };
    if (upcoming) where.startAt = { gte: new Date(Date.now() - 24 * 3600 * 1000) };

    let events = await db.schoolEvent.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { startAt: upcoming ? "asc" : "desc" },
      take: upcoming ? 12 : 200,
    });

    // رویدادهای کلاسِ خاص برای دانش‌آموز/ولی آن کلاس
    if (me.role === "STUDENT" || me.role === "PARENT") {
      const classIds: string[] = [];
      if (me.role === "STUDENT") {
        const p = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
        if (p?.classId) classIds.push(p.classId);
      } else {
        const kids = await db.studentParent.findMany({
          where: { parentUserId: me.id },
          include: { student: { select: { classId: true } } },
        });
        classIds.push(...(kids.map((k) => k.student.classId).filter(Boolean) as string[]));
      }
      events = events.filter((e) => e.audience !== "CLASS" || (e.classId && classIds.includes(e.classId)));
    }

    return apiOk({ events, today: todayJalali() });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/events — ایجاد رویداد */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_events");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, string>>(req);

    const title = String(body.title ?? "").trim();
    const startAt = String(body.startAt ?? "");
    if (title.length < 2 || !startAt) return apiErr(400, "عنوان و زمان شروع الزامی است.", "BAD_INPUT");
    const start = new Date(startAt);
    if (isNaN(start.getTime())) return apiErr(400, "زمان شروع نامعتبر است.", "BAD_DATE");
    let end: Date | null = null;
    if (body.endAt) {
      end = new Date(String(body.endAt));
      if (isNaN(end.getTime())) return apiErr(400, "زمان پایان نامعتبر است.", "BAD_DATE");
    }

    const kind = ["MEETING", "CEREMONY", "EXAM", "HOLIDAY", "TRIP", "WORKSHOP", "OTHER"].includes(String(body.kind))
      ? String(body.kind) : "OTHER";
    const audience = ["ALL", "STUDENTS", "TEACHERS", "PARENTS", "CLASS"].includes(String(body.audience))
      ? String(body.audience) : "ALL";

    let classId: string | null = null;
    if (audience === "CLASS") {
      classId = String(body.classId ?? "");
      const cls = await db.class.findUnique({ where: { id: classId } });
      if (!cls || cls.schoolId !== schoolId) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
    }

    const event = await db.schoolEvent.create({
      data: {
        schoolId, title,
        description: body.description ? String(body.description) : null,
        startAt: start, endAt: end, kind, audience, classId,
        createdById: me.id,
      },
    });
    await audit({ user: me, action: "CREATE_EVENT", entityType: "EVENT", entityId: event.id, schoolId });
    return apiOk({ event });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.schoolEvent.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.schoolEvent.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
