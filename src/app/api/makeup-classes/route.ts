import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyMany } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/makeup-classes — کلاس‌های جبرانی پیش‌رو؛ POST: ثبت + خبر به دانش‌آموزان و اولیای کلاس */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const rows = await db.makeupClass.findMany({ where: { schoolId }, orderBy: { newDate: "asc" }, take: 200 });
    const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true } });
    const byId = new Map(classes.map((c) => [c.id, c.name]));
    return apiOk({
      isStaff: (STAFF as readonly string[]).includes(me.role),
      classes,
      items: rows.map((r) => ({ ...r, className: byId.get(r.classId) ?? "" })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ classId?: string; subject?: string; teacherName?: string; originalDate?: string; newDate?: string; room?: string; note?: string }>(req);
    const subject = String(body.subject ?? "").trim();
    if (!subject) return apiErr(400, "نام درس لازم است.", "BAD_INPUT");
    const cls = await db.class.findFirst({ where: { id: String(body.classId ?? ""), schoolId }, select: { id: true, name: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const newDate = String(body.newDate ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) return apiErr(400, "تاریخ جبرانی را مثل 1404-08-15 بنویسید.", "BAD_DATE");
    const created = await db.makeupClass.create({
      data: {
        schoolId, classId: cls.id, subject,
        teacherName: body.teacherName ? String(body.teacherName).trim() : null,
        originalDate: String(body.originalDate ?? "").trim() || "—",
        newDate,
        room: body.room ? String(body.room).trim() : null,
        note: body.note ? String(body.note).trim() : null,
        createdById: me.id,
      },
    });
    const students = await db.student.findMany({ where: { schoolId, classId: cls.id, status: "ACTIVE" }, select: { userId: true, id: true } });
    const parentLinks = await db.studentParent.findMany({ where: { studentId: { in: students.map((s) => s.id) } }, select: { parentUserId: true } });
    const targets = [...new Set([...students.map((s) => s.userId), ...parentLinks.map((p) => p.parentUserId)])];
    if (targets.length) {
      await notifyMany(targets, "IMPORTANT", "کلاس جبرانی چیده شد",
        `${subject} کلاس ${cls.name} که ${created.originalDate} برگزار نشد، ${newDate} جبرانی برگزار می‌شود${created.room ? ` (${created.room})` : ""}.`,
        "/app/makeup-classes", "MAKEUP");
    }
    return apiOk({ id: created.id, notified: targets.length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.makeupClass.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.makeupClass.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
