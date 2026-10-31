import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"];

/**
 * GET   /api/absence-excuses — ولی: توجیه‌های خودش + غیبت‌های بدون توجیه فرزندانش؛
 *        کارکنان: صف توجیه‌های مدرسه (پیش‌فرض در انتظار بررسی)
 * POST  /api/absence-excuses — ولی برای یک روز غیبت فرزندش دلیل می‌فرستد
 * PATCH /api/absence-excuses — کارکنان تأیید/رد می‌کنند؛ تأیید یعنی وضعیت
 *        حضور آن روز «موجه» می‌شود و ولی از نتیجه باخبر می‌شود
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);

    if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        select: { studentId: true },
      });
      const childIds = links.map((l) => l.studentId);
      if (!childIds.length) return apiOk({ excuses: [], openAbsences: [], children: [] });
      const [excuses, openAbsences, children] = await Promise.all([
        db.absenceExcuse.findMany({
          where: { parentUserId: me.id },
          orderBy: { createdAt: "desc" },
          take: 100,
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
        db.attendance.findMany({
          where: { studentId: { in: childIds }, status: "ABSENT", period: 0 },
          orderBy: { date: "desc" },
          take: 100,
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
        db.student.findMany({
          where: { id: { in: childIds } },
          include: { user: { select: { firstName: true, lastName: true } } },
        }),
      ]);
      const excusedKeys = new Set(excuses.map((e) => `${e.studentId}|${e.date}`));
      return apiOk({
        excuses: excuses.map((e) => ({
          id: e.id, studentId: e.studentId, date: e.date, text: e.text, status: e.status,
          studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
          createdAt: e.createdAt,
        })),
        openAbsences: openAbsences
          .filter((a) => !excusedKeys.has(`${a.studentId}|${a.date}`))
          .map((a) => ({
            studentId: a.studentId, date: a.date,
            studentName: `${a.student.user.firstName} ${a.student.user.lastName}`,
          })),
        children: children.map((c) => ({ id: c.id, name: `${c.user.firstName} ${c.user.lastName}` })),
      });
    }

    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const schoolId = requireSchoolId(me);
    const status = searchParams.get("status") ?? "PENDING";
    const excuses = await db.absenceExcuse.findMany({
      where: { schoolId, ...(status === "ALL" ? {} : { status }) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
    });
    const parentIds = [...new Set(excuses.map((e) => e.parentUserId))];
    const parents = parentIds.length
      ? await db.user.findMany({ where: { id: { in: parentIds } }, select: { id: true, firstName: true, lastName: true } })
      : [];
    const parentName = new Map(parents.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
    return apiOk({
      excuses: excuses.map((e) => ({
        id: e.id, studentId: e.studentId, date: e.date, text: e.text, status: e.status,
        studentName: `${e.student.user.firstName} ${e.student.user.lastName}`,
        parentName: parentName.get(e.parentUserId) ?? "",
        createdAt: e.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["PARENT"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ studentId?: string; date?: string; text?: string }>(req);
    const studentId = String(body.studentId ?? "");
    const date = String(body.date ?? "").trim();
    const text = String(body.text ?? "").trim();
    if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || text.length < 3) {
      return apiErr(400, "دانش‌آموز، تاریخ و متن دلیل (دست‌کم ۳ نویسه) لازم است.", "BAD_INPUT");
    }
    if (text.length > 1000) return apiErr(400, "متن دلیل بیش از حد طولانی است.", "BAD_INPUT");
    const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
    if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    const student = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const absence = await db.attendance.findUnique({
      where: { studentId_date_period: { studentId, date, period: 0 } },
      select: { status: true },
    });
    if (!absence || absence.status !== "ABSENT") {
      return apiErr(400, "برای این تاریخ غیبتی ثبت نشده است.", "NO_ABSENCE");
    }
    const existing = await db.absenceExcuse.findUnique({
      where: { studentId_date_parentUserId: { studentId, date, parentUserId: me.id } },
      select: { id: true, status: true },
    });
    if (existing) return apiErr(409, "برای این غیبت قبلاً دلیل فرستاده‌اید.", "DUPLICATE");
    const excuse = await db.absenceExcuse.create({
      data: { schoolId: student.schoolId, studentId, parentUserId: me.id, date, text },
    });
    await audit({ user: me, action: "absenceExcuse.create", entityType: "STUDENT", entityId: studentId, meta: { date }, schoolId: student.schoolId });
    return apiOk({ excuse: { id: excuse.id, status: excuse.status } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; decision?: string }>(req);
    const id = String(body.id ?? "");
    const decision = String(body.decision ?? "");
    if (!id || !["APPROVE", "REJECT"].includes(decision)) {
      return apiErr(400, "شناسه و تصمیم (APPROVE/REJECT) لازم است.", "BAD_INPUT");
    }
    const excuse = await db.absenceExcuse.findUnique({ where: { id } });
    if (!excuse || excuse.schoolId !== schoolId) return apiErr(404, "توجیه یافت نشد.", "NOT_FOUND");
    if (excuse.status !== "PENDING") return apiErr(409, "این توجیه قبلاً بررسی شده است.", "ALREADY_DECIDED");

    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    await db.$transaction(async (tx) => {
      await tx.absenceExcuse.update({
        where: { id },
        data: { status, decidedById: me.id, decidedAt: new Date() },
      });
      if (decision === "APPROVE") {
        // غیبت آن روز «موجه» می‌شود؛ اگر معلم بعداً دستی عوضش کرده باشد دست نمی‌زنیم
        await tx.attendance.updateMany({
          where: { studentId: excuse.studentId, date: excuse.date, period: 0, status: "ABSENT" },
          data: { status: "EXCUSED" },
        });
      }
    });
    await audit({ user: me, action: `absenceExcuse.${decision.toLowerCase()}`, entityType: "STUDENT", entityId: excuse.studentId, meta: { date: excuse.date }, schoolId });
    const student = await db.student.findUnique({
      where: { id: excuse.studentId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    const studentName = student ? `${student.user.firstName} ${student.user.lastName}` : "";
    await notifyUser(
      excuse.parentUserId,
      decision === "APPROVE" ? "SUCCESS" : "IMPORTANT",
      decision === "APPROVE" ? "توجیه غیبت پذیرفته شد" : "توجیه غیبت پذیرفته نشد",
      decision === "APPROVE"
        ? `غیبت ${studentName} در تاریخ ${excuse.date} موجه ثبت شد.`
        : `توجیه غیبت ${studentName} در تاریخ ${excuse.date} پذیرفته نشد؛ برای پیگیری با مدرسه در تماس باشید.`,
      "/app/excuses",
      "ABSENCE_EXCUSE",
    );
    return apiOk({ ok: true, status });
  } catch (e) {
    return handleApiError(e);
  }
}
