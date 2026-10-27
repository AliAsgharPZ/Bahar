import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | طرح درس و پوشش بودجه‌بندی — معلم برای هر جلسه مبحث
   و اهداف را ثبت می‌کند و وضعیت را «تدریس‌شده» می‌زند؛ مدیر
   پوشش هر معلم/کلاس را (برنامه‌ریزی‌شده در برابر تدریس‌شده)
   در یک نگاه می‌بیند و جایگزین هم از طرح همان روز استفاده
   می‌کند.
   ============================================================ */

const STAFF = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const url = new URL(req.url);
    const classId = url.searchParams.get("classId") ?? "";
    const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role);

    const plans = await db.lessonPlan.findMany({
      where: {
        schoolId,
        ...(isManager ? {} : { teacherId: me.id }),
        ...(classId ? { classId } : {}),
      },
      orderBy: [{ date: "desc" }],
      take: 300,
    });
    const teacherIds = [...new Set(plans.map((p) => p.teacherId))];
    const teachers = new Map(
      (await db.user.findMany({ where: { id: { in: teacherIds } }, select: { id: true, firstName: true, lastName: true } }))
        .map((u) => [u.id, `${u.firstName} ${u.lastName}`]),
    );
    const subjects = new Map(
      (await db.subject.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
    );
    const classes = new Map(
      (await db.class.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((c) => [c.id, c.name]),
    );
    const rows = plans.map((p) => ({
      ...p,
      teacherName: teachers.get(p.teacherId) ?? "—",
      subjectName: p.subjectId ? subjects.get(p.subjectId) ?? "" : "",
      className: p.classId ? classes.get(p.classId) ?? "" : "",
    }));
    // پوشش: به‌ازای هر معلم
    const coverage = teacherIds.map((tid) => {
      const mine = plans.filter((p) => p.teacherId === tid);
      return {
        teacherId: tid, teacherName: teachers.get(tid) ?? "—",
        planned: mine.length, taught: mine.filter((p) => p.status === "TAUGHT").length,
      };
    });
    return apiOk({ plans: rows, coverage });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      action?: string; id?: string; classId?: string; subjectId?: string;
      topic?: string; date?: string; objectives?: string; status?: string;
    }>(req);

    if (body.action === "delete") {
      await db.lessonPlan.deleteMany({
        where: { id: String(body.id ?? ""), schoolId, ...(me.role === "TEACHER" ? { teacherId: me.id } : {}) },
      });
      return apiOk({ ok: true });
    }
    if (body.action === "taught") {
      await db.lessonPlan.updateMany({
        where: { id: String(body.id ?? ""), schoolId, ...(me.role === "TEACHER" ? { teacherId: me.id } : {}) },
        data: { status: "TAUGHT" },
      });
      return apiOk({ ok: true });
    }
    const topic = (body.topic ?? "").trim();
    const date = String(body.date ?? "");
    if (topic.length < 3) return apiErr(400, "مبحث را بنویسید.", "BAD_INPUT");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiErr(400, "تاریخ را مثل 1405-08-05 بنویسید.", "BAD_DATE");
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NO_CLASS");
    }
    const plan = await db.lessonPlan.create({
      data: {
        schoolId, teacherId: me.id,
        classId: body.classId || null, subjectId: body.subjectId || null,
        topic: topic.slice(0, 200), date,
        objectives: body.objectives?.trim().slice(0, 1000) || null,
        status: body.status === "TAUGHT" ? "TAUGHT" : "PLANNED",
      },
    });
    return apiOk({ plan });
  } catch (e) {
    return handleApiError(e);
  }
}
