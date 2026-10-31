import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor, demoWriteBlock, audit, toDate } from "@/lib/api";
import { clampScores, observationAverage, parseScores } from "@/lib/observations";

/* ============================================================
   بهار | مشاهدهٔ کلاس و ارزشیابی معلم — مدیر/معاون ثبت می‌کند،
   معلم فقط مشاهده‌های خودش را می‌بیند.
   ============================================================ */

const VIEWERS = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];
const WRITERS = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, VIEWERS);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const isTeacher = me.role === "TEACHER";
    const rows = await db.classObservation.findMany({
      where: { schoolId, ...(isTeacher ? { teacherId: me.id } : {}) },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 300,
    });
    const userIds = [...new Set(rows.flatMap((r) => [r.teacherId, r.observerId]))];
    const users = new Map(
      (await db.user.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true, lastName: true } }))
        .map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
    const classIds = [...new Set(rows.map((r) => r.classId).filter((x): x is string => !!x))];
    const classes = new Map(
      (await db.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }))
        .map((c) => [c.id, c.name]),
    );
    const teachers = isTeacher
      ? []
      : await db.user.findMany({
          where: { schoolId, role: "TEACHER", isActive: true },
          select: { id: true, firstName: true, lastName: true },
          orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
        });
    const classList = await db.class.findMany({
      where: { schoolId, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    return apiOk({
      observations: rows.map((r) => ({
        id: r.id,
        teacherId: r.teacherId,
        teacherName: users.get(r.teacherId) ?? "—",
        observerId: r.observerId,
        observerName: users.get(r.observerId) ?? "—",
        classId: r.classId,
        className: r.classId ? classes.get(r.classId) ?? null : null,
        date: r.date,
        topic: r.topic,
        scores: parseScores(r.scores),
        average: r.average,
        strengths: r.strengths,
        growthAreas: r.growthAreas,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
      teachers: teachers.map((t) => ({ id: t.id, name: `${t.firstName} ${t.lastName}` })),
      classes: classList,
      canWrite: WRITERS.includes(me.role),
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
      teacherId?: string; classId?: string; date?: string; topic?: string;
      scores?: Record<string, unknown>; strengths?: string; growthAreas?: string; comment?: string;
    }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const teacherId = String(body.teacherId ?? "");
    const teacher = await db.user.findFirst({
      where: { id: teacherId, schoolId, role: "TEACHER" },
      select: { id: true },
    });
    if (!teacher) return apiErr(404, "معلم یافت نشد.", "NOT_FOUND");
    let classId: string | null = null;
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: String(body.classId), schoolId }, select: { id: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
      classId = cls.id;
    }
    const date = body.date ? toDate(body.date) : new Date();
    if (!date) return apiErr(400, "تاریخ نامعتبر است.", "BAD_DATE");
    const scores = clampScores(body.scores);
    const rec = await db.classObservation.create({
      data: {
        schoolId,
        teacherId,
        observerId: me.id,
        classId,
        date,
        topic: body.topic?.trim().slice(0, 300) || null,
        scores: JSON.stringify(scores),
        average: observationAverage(scores),
        strengths: body.strengths?.trim().slice(0, 2000) || null,
        growthAreas: body.growthAreas?.trim().slice(0, 2000) || null,
        comment: body.comment?.trim().slice(0, 2000) || null,
      },
    });
    await audit({ user: me, action: "observation.create", entityType: "ClassObservation", entityId: rec.id, schoolId, meta: { teacherId, average: rec.average } });
    return apiOk({ observation: { id: rec.id, average: rec.average } });
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
    const res = await db.classObservation.deleteMany({ where: { id, schoolId } });
    if (res.count === 0) return apiErr(404, "مشاهده یافت نشد.", "NOT_FOUND");
    await audit({ user: me, action: "observation.delete", entityType: "ClassObservation", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
