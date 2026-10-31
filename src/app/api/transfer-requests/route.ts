import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/transfer-requests — درخواست‌های انتقال به مدرسهٔ دیگر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const rows = await db.transferRequest.findMany({
      where: { schoolId, ...(isOffice ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      isOffice,
      items: rows.map((r) => ({
        ...r,
        studentName: byId.get(r.studentId) ? `${byId.get(r.studentId)!.user.firstName} ${byId.get(r.studentId)!.user.lastName}` : "",
        className: byId.get(r.studentId)?.class?.name ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; toSchool?: string; reason?: string }>(req);
    const toSchool = String(body.toSchool ?? "").trim();
    if (!toSchool) return apiErr(400, "نام مدرسهٔ مقصد لازم است.", "BAD_INPUT");
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p) return apiErr(404, "پروندهٔ دانش‌آموزی یافت نشد.", "NOT_FOUND");
      studentId = p.id;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.transferRequest.create({
      data: { schoolId, studentId, requesterId: me.id, toSchool, reason: body.reason ? String(body.reason).trim() : null },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["APPROVED", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.transferRequest.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    const updated = await db.transferRequest.update({ where: { id: found.id }, data: { status, handledById: me.id } });
    await notifyUser(found.requesterId, status === "APPROVED" ? "SUCCESS" : "INFO",
      status === "APPROVED" ? "انتقال تأیید شد" : "انتقال رد شد",
      `درخواست انتقال به «${found.toSchool}»: ${status === "APPROVED" ? "تأیید شد؛ برای پرونده و گواهی انتقال به دفتر بیایید" : "رد شد"}.`,
      "/app/transfer-requests", "TRANSFER");
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
