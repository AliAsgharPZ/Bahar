import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor, demoWriteBlock, audit, toDate } from "@/lib/api";
import { MINUTE_KINDS, parseActions, parseAttendees, cleanActions } from "@/lib/minutes";

/* ============================================================
   بهار | صورتجلسات — کادر مدرسه می‌خوانند؛ مدیر/معاون ثبت و
   حذف می‌کند؛ مسئول هر اقدام می‌تواند اقدام خودش را انجام‌شده
   علامت بزند.
   ============================================================ */

const VIEWERS = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];
const WRITERS = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];
const STAFF_ROLES = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN"];

async function staffOf(schoolId: string) {
  return db.user.findMany({
    where: { schoolId, role: { in: STAFF_ROLES }, isActive: true },
    select: { id: true, firstName: true, lastName: true, role: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, VIEWERS);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const rows = await db.meetingMinute.findMany({
      where: { schoolId },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
    });
    const staff = await staffOf(schoolId);
    const names = new Map(staff.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    const authorIds = [...new Set(rows.map((r) => r.authorId).filter((id) => !names.has(id)))];
    if (authorIds.length) {
      const extra = await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, firstName: true, lastName: true } });
      for (const u of extra) names.set(u.id, `${u.firstName} ${u.lastName}`);
    }
    return apiOk({
      minutes: rows.map((r) => {
        const attendees = parseAttendees(r.attendees);
        const actions = parseActions(r.actions);
        return {
          id: r.id,
          title: r.title,
          kind: r.kind,
          date: r.date,
          authorName: names.get(r.authorId) ?? "—",
          attendeeNames: attendees.map((id) => names.get(id) ?? "—"),
          agenda: r.agenda,
          decisions: r.decisions,
          actions: actions.map((a) => ({ ...a, ownerName: a.ownerId ? names.get(a.ownerId) ?? "—" : null })),
          openActions: actions.filter((a) => !a.done).length,
          createdAt: r.createdAt,
        };
      }),
      staff: staff.map((u) => ({ id: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role })),
      kinds: MINUTE_KINDS,
      canWrite: WRITERS.includes(me.role),
      myId: me.id,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, WRITERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      title?: string; kind?: string; date?: string; attendees?: unknown;
      agenda?: string; decisions?: string; actions?: unknown;
    }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const title = String(body.title ?? "").trim().slice(0, 300);
    if (!title) return apiErr(400, "عنوان جلسه لازم است.", "BAD_INPUT");
    const kind = MINUTE_KINDS.some((k) => k.key === body.kind) ? String(body.kind) : "STAFF";
    const date = body.date ? toDate(body.date) : new Date();
    if (!date) return apiErr(400, "تاریخ نامعتبر است.", "BAD_DATE");
    const staff = await staffOf(schoolId);
    const staffIds = new Set(staff.map((u) => u.id));
    const attendees = Array.isArray(body.attendees)
      ? body.attendees.filter((x): x is string => typeof x === "string" && staffIds.has(x)).slice(0, 100)
      : [];
    const actions = cleanActions(body.actions).map((a) => ({ ...a, ownerId: a.ownerId && staffIds.has(a.ownerId) ? a.ownerId : null }));
    const rec = await db.meetingMinute.create({
      data: {
        schoolId,
        authorId: me.id,
        title,
        kind,
        date,
        attendees: JSON.stringify(attendees),
        agenda: body.agenda?.trim().slice(0, 4000) || null,
        decisions: body.decisions?.trim().slice(0, 4000) || null,
        actions: JSON.stringify(actions),
      },
    });
    await audit({ user: me, action: "minute.create", entityType: "MeetingMinute", entityId: rec.id, schoolId, meta: { kind } });
    return apiOk({ minute: { id: rec.id } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, VIEWERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ id?: string; actionId?: string; done?: boolean }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const id = String(body.id ?? "");
    const row = await db.meetingMinute.findFirst({ where: { id, schoolId } });
    if (!row) return apiErr(404, "صورتجلسه یافت نشد.", "NOT_FOUND");
    const actions = parseActions(row.actions);
    const target = actions.find((a) => a.id === String(body.actionId ?? ""));
    if (!target) return apiErr(404, "اقدام یافت نشد.", "NOT_FOUND");
    // فقط نویسنده‌های صورتجلسه یا خودِ مسئول اقدام می‌توانند وضعیتش را عوض کنند
    if (!WRITERS.includes(me.role) && target.ownerId !== me.id) {
      return apiErr(403, "فقط مسئول اقدام یا مدیر می‌تواند وضعیت آن را تغییر دهد.", "FORBIDDEN");
    }
    target.done = body.done === true;
    await db.meetingMinute.update({ where: { id: row.id }, data: { actions: JSON.stringify(actions) } });
    return apiOk({ ok: true, actions });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, WRITERS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_INPUT");
    const res = await db.meetingMinute.deleteMany({ where: { id, schoolId } });
    if (res.count === 0) return apiErr(404, "صورتجلسه یافت نشد.", "NOT_FOUND");
    await audit({ user: me, action: "minute.delete", entityType: "MeetingMinute", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
