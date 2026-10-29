import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser, demoWriteBlock } from "@/lib/api";

/**
 * GET /api/attendance?classId=&date=1404-07-10 — برگه حضور و غیاب
 * GET /api/attendance?studentId= — سابقه دانش‌آموز
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const date = searchParams.get("date");
    const studentId = searchParams.get("studentId");

    // ── سابقه دانش‌آموز (خودش / ولی / کارکنان هم‌مدرسه) ──
    if (studentId || me.role === "STUDENT") {
      let targetStudentId = studentId;
      if (me.role === "STUDENT") {
        const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
        targetStudentId = profile?.id ?? null;
      } else if (me.role === "PARENT" && studentId) {
        const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
        if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      } else if (me.role === "PARENT") {
        return apiOk({ records: [] });
      } else if (studentId) {
        // کارکنان: دانش‌آموز باید در همان مدرسه باشد
        const target = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
        if (!target) return apiOk({ records: [] });
        if (me.role !== "SUPER_ADMIN" && me.role !== "ADMIN" && target.schoolId !== me.schoolId) {
          return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
        }
      }
      if (!targetStudentId) return apiOk({ records: [] });
      const records = await db.attendance.findMany({
        where: { studentId: targetStudentId },
        orderBy: { date: "desc" },
        take: 200,
      });
      return apiOk({ records });
    }

    if (me.role === "PARENT" || me.role === "STUDENT") {
      return apiErr(403, "برای شما تعریف نشده است.", "FORBIDDEN");
    }

    // ── برگه روز کلاس ──
    if (!classId) return apiErr(400, "کلاس را مشخص کنید.", "BAD_INPUT");
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const schoolId = requireSchoolId(me);
    if (cls.schoolId !== schoolId && me.role !== "SUPER_ADMIN" && me.role !== "ADMIN") {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }

    const students = await db.student.findMany({
      where: { classId, user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true, nationalId: true } } },
      orderBy: { user: { lastName: "asc" } },
    });

    const existing = date
      ? await db.attendance.findMany({ where: { classId, date } })
      : [];

    // ── هشدار سلامت جسمانی کنار هر دانش‌آموز (دبیر ورزش/معلم در لحظه حضور و غیاب می‌بیند) ──
    const healthRows = students.length
      ? await db.studentHealth.findMany({ where: { studentId: { in: students.map((s) => s.id) } } })
      : [];
    const healthOf = (sid: string) => {
      const h = healthRows.find((x) => x.studentId === sid);
      if (!h) return null;
      const flags: string[] = [];
      if (h.asthma) flags.push("آسم");
      if (h.heartCondition) flags.push("قلبی");
      if (h.seizures) flags.push("صرع");
      if (h.diabetes) flags.push("دیابت");
      if (h.sportsStatus === "FULL" && flags.length === 0 && !h.conditions && !h.mobilityNote) return null;
      return {
        sportsStatus: h.sportsStatus, sportsNote: h.sportsNote,
        conditions: h.conditions, mobilityNote: h.mobilityNote,
        allergies: h.allergies, flags,
      };
    };

    return apiOk({
      students: students.map((s) => {
        const rec = existing.find((e) => e.studentId === s.id);
        return {
          studentId: s.id,
          userId: s.userId,
          fullName: `${s.user.firstName} ${s.user.lastName}`,
          nationalId: s.user.nationalId,
          studentNumber: s.studentNumber,
          status: rec?.status ?? null,
          note: rec?.note ?? null,
          healthAlert: healthOf(s.id),
        };
      }),
      date,
      class: { id: cls.id, name: cls.name },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/attendance — ذخیره برگه روز */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "take_attendance");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      classId?: string; date?: string;
      records?: Array<{ studentId?: string; status?: string; note?: string | null; period?: number }>;
    }>(req);

    const classId = String(body.classId ?? "");
    const date = String(body.date ?? "").trim();
    if (!classId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiErr(400, "کلاس و تاریخ (شکل 1404-07-10) الزامی است.", "BAD_INPUT");
    }
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    // معلم فقط برای کلاس‌های خودش
    if (me.role === "TEACHER") {
      const teaches = await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId } });
      const homeroom = cls.homeroomTeacherId === me.id;
      if (!teaches && !homeroom) {
        return apiErr(403, "شما معلم این کلاس نیستید.", "FORBIDDEN");
      }
    }

    const records = Array.isArray(body.records) ? body.records.slice(0, 500) : [];
    const validStatuses = ["PRESENT", "ABSENT", "LATE", "EXCUSED", "MISSION", "HALF_DAY"];
    const students = await db.student.findMany({ where: { classId }, select: { id: true } });
    const studentIds = new Set(students.map((s) => s.id));

    const operations: Array<ReturnType<typeof db.attendance.upsert>> = [];
    let saved = 0;
    for (const r of records) {
      if (!r.studentId || !studentIds.has(r.studentId)) continue;
      const status = String(r.status ?? "PRESENT");
      if (!validStatuses.includes(status)) continue;
      saved++;
      const period = Number(r.period) > 0 ? Number(r.period) : 0;
      operations.push(
        db.attendance.upsert({
          where: { studentId_date_period: { studentId: r.studentId, date, period } },
          create: {
            studentId: r.studentId, classId, date, period, status,
            note: r.note || null, recordedById: me.id,
          },
          update: { status, note: r.note || null, recordedById: me.id },
        })
      );
    }
    await db.$transaction(operations);

    // ── اتوماسیون: غیبت به آستانه رسید + درصد حضور پایین ──
    try {
      // FIX (راند ۱۶): فقط دانش‌آموزان این مدرسه — studentId جعلی خودکار رد می‌شود
      const schoolStudentIds = new Set(studentIds);
      const absents = (records as Array<{ studentId?: string; status?: string }>).filter((r) => r.status === "ABSENT" && r.studentId && schoolStudentIds.has(r.studentId));
      const touched = [...new Set((records as Array<{ studentId?: string }>).map((r) => r.studentId).filter(Boolean))] as string[];
      const { runAutomations } = await import("@/lib/automation");
      for (const r of absents.slice(0, 40)) {
        if (!r.studentId) continue;
        const totalAbs = await db.attendance.count({ where: { studentId: r.studentId, status: "ABSENT" } });
        const su = await db.student.findUnique({ where: { id: r.studentId }, include: { user: { select: { firstName: true, lastName: true } } } });
        if (su) {
          await runAutomations({
            type: "ABSENT_THRESHOLD",
            schoolId,
            studentId: r.studentId,
            studentName: `${su.user.firstName} ${su.user.lastName}`,
            absences: totalAbs,
            classId,
          });
        }
      }
      // درصد حضورِ تک‌نفره: فقط برای دانش‌آموزانی که امروز غیبت ثبت شد و سابقه کافی دارند
      for (const sid of touched.slice(0, 40)) {
        const [total, present] = await Promise.all([
          db.attendance.count({ where: { studentId: sid } }),
          db.attendance.count({ where: { studentId: sid, status: "PRESENT" } }),
        ]);
        if (total < 10) continue; // آمار ناکافی
        const rate = Math.round((present / total) * 100);
        if (rate >= 90) continue; // فقط حضورِ به‌مراتب پایین
        const su = await db.student.findUnique({ where: { id: sid }, include: { user: { select: { firstName: true, lastName: true } } } });
        if (su) {
          await runAutomations({
            type: "LOW_ATTENDANCE",
            schoolId,
            studentId: sid,
            studentName: `${su.user.firstName} ${su.user.lastName}`,
            rate,
          });
        }
      }
    } catch { /* اتوماسیون نباید ثبت حضور را متوقف کند */ }

    await audit({
      user: me, action: "SAVE_ATTENDANCE", entityType: "CLASS", entityId: classId,
      meta: { date, saved }, schoolId,
    });
    return apiOk({ ok: true, saved });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const bulkClass = url.searchParams.get("classId") ?? "";
    const bulkDate = url.searchParams.get("date") ?? "";
    // FIX: معلم فقط کلاس‌های خودش را حذف می‌کند — هم‌قاعده با POST
    const teacherMayDeleteClass = async (classId: string, homeroomTeacherId: string | null) => {
      if (me.role !== "TEACHER") return true;
      const teaches = await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId } });
      return !!teaches || homeroomTeacherId === me.id;
    };
    if (!id && bulkClass && bulkDate) {
      // حذف برگهٔ کامل یک روز برای یک کلاس
      const cls = await db.class.findUnique({ where: { id: bulkClass }, select: { schoolId: true, homeroomTeacherId: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
      if (me.schoolId && cls.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (!(await teacherMayDeleteClass(bulkClass, cls.homeroomTeacherId))) return apiErr(403, "شما معلم این کلاس نیستید.", "FORBIDDEN");
      const students = await db.student.findMany({ where: { classId: bulkClass }, select: { id: true } });
      const res = await db.attendance.deleteMany({ where: { classId: bulkClass, date: bulkDate, studentId: { in: students.map((s) => s.id) } } });
      return apiOk({ ok: true, deleted: res.count });
    }
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.attendance.findUnique({ where: { id }, select: { classId: true, student: { select: { schoolId: true } } } });
    if (!row) return apiErr(404, "رکورد حضور یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.student.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const rowClass = await db.class.findUnique({ where: { id: row.classId }, select: { homeroomTeacherId: true } });
    if (!(await teacherMayDeleteClass(row.classId, rowClass?.homeroomTeacherId ?? null))) return apiErr(403, "شما معلم این کلاس نیستید.", "FORBIDDEN");
    await db.attendance.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
