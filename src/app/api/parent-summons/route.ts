import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"];

/**
 * GET   /api/parent-summons — کارکنان: صف احضارهای مدرسه + والدین هر دانش‌آموز برای فرم؛
 *        ولی: احضارهای خودش
 * POST  /api/parent-summons — معاون/مدیر ولیِ یک دانش‌آموز را احضار می‌کند (اعلان می‌رود)
 * PATCH /api/parent-summons — ولی: تأیید مشاهده؛ کارکنان: انجام شد / لغو
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);

    if (me.role === "PARENT") {
      const rows = await db.parentSummon.findMany({
        where: { parentUserId: me.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      });
      return apiOk({
        summons: rows.map((s) => ({
          id: s.id, studentId: s.studentId, reason: s.reason, whenText: s.whenText, status: s.status,
          studentName: `${s.student.user.firstName} ${s.student.user.lastName}`,
          className: s.student.class?.name ?? "", createdAt: s.createdAt,
        })),
      });
    }

    if (!STAFF.includes(me.role)) throw new Error("FORBIDDEN");
    const schoolId = requireSchoolId(me);
    const status = searchParams.get("status");
    const [rows, students] = await Promise.all([
      db.parentSummon.findMany({
        where: { schoolId, ...(status ? { status } : {}) },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      }),
      db.student.findMany({
        where: { schoolId },
        orderBy: { user: { lastName: "asc" } },
        take: 500,
        include: {
          user: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
          parents: { include: { parentUser: { select: { id: true, firstName: true, lastName: true } } } },
        },
      }),
    ]);
    const parentUsers = await db.user.findMany({
      where: { id: { in: [...new Set(rows.map((r) => r.parentUserId))] } },
      select: { id: true, firstName: true, lastName: true },
    });
    const parentName = new Map(parentUsers.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return apiOk({
      summons: rows.map((s) => ({
        id: s.id, studentId: s.studentId, parentUserId: s.parentUserId, reason: s.reason, whenText: s.whenText,
        status: s.status, excuseId: s.excuseId,
        studentName: `${s.student.user.firstName} ${s.student.user.lastName}`,
        className: s.student.class?.name ?? "",
        parentName: parentName.get(s.parentUserId) ?? "",
        createdAt: s.createdAt,
      })),
      students: students.map((s) => ({
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        className: s.class?.name ?? "",
        parents: s.parents.map((p) => ({ userId: p.parentUser.id, name: `${p.parentUser.firstName} ${p.parentUser.lastName}` })),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!STAFF.includes(me.role)) throw new Error("FORBIDDEN");
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; parentUserId?: string; reason?: string; whenText?: string; excuseId?: string }>(req);
    const studentId = String(body.studentId ?? "");
    const parentUserId = String(body.parentUserId ?? "");
    const reason = String(body.reason ?? "").trim();
    const whenText = String(body.whenText ?? "").trim();
    if (!studentId || !parentUserId || !reason || !whenText) return apiErr(400, "دانش‌آموز، ولی، دلیل و زمان پیشنهادی لازم است.", "BAD_INPUT");
    const link = await db.studentParent.findFirst({ where: { studentId, parentUserId } });
    if (!link) return apiErr(400, "این کاربر ولیِ این دانش‌آموز نیست.", "NOT_LINKED");
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, include: { user: { select: { firstName: true, lastName: true } } } });
    if (!student) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    const created = await db.parentSummon.create({
      data: {
        schoolId, studentId, parentUserId, reason, whenText,
        excuseId: body.excuseId ? String(body.excuseId) : null,
        createdById: me.id,
      },
    });
    await notifyUser(
      parentUserId,
      "IMPORTANT",
      "احضار به مدرسه",
      `برای ${student.user.firstName} ${student.user.lastName}: ${reason} — زمان پیشنهادی: ${whenText}`,
      "/app/excuses",
    ).catch(() => null);
    await audit({ user: me, action: "parentSummon.create", entityType: "STUDENT", entityId: studentId, meta: {}, schoolId });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ id?: string; action?: string }>(req);
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    const row = await db.parentSummon.findUnique({ where: { id } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.role === "PARENT") {
      if (row.parentUserId !== me.id) throw new Error("FORBIDDEN");
      if (action !== "ACK" || row.status !== "PENDING") return apiErr(409, "این احضار در این وضعیت قابل تغییر نیست.", "BAD_STATE");
      await db.parentSummon.update({ where: { id }, data: { status: "ACKED" } });
      return apiOk({ ok: true });
    }
    if (!STAFF.includes(me.role)) throw new Error("FORBIDDEN");
    if (requireSchoolId(me) !== row.schoolId) throw new Error("FORBIDDEN");
    if (action === "DONE" && (row.status === "PENDING" || row.status === "ACKED")) {
      await db.parentSummon.update({ where: { id }, data: { status: "DONE" } });
    } else if (action === "CANCEL" && row.status !== "DONE") {
      await db.parentSummon.update({ where: { id }, data: { status: "CANCELLED" } });
    } else {
      return apiErr(409, "این احضار در این وضعیت قابل تغییر نیست.", "BAD_STATE");
    }
    await audit({ user: me, action: `parentSummon.${action.toLowerCase()}`, entityType: "STUDENT", entityId: row.studentId, meta: {}, schoolId: row.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
