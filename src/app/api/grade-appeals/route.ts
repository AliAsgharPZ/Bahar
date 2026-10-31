import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/grade-appeals — کارکنان: صف اعتراض‌ها؛ دانش‌آموز/ولی: اعتراض‌های خودشان */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    const rows = await db.gradeAppeal.findMany({
      where: { schoolId, ...(isStaff ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      isStaff,
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
    const body = await readJson<{ studentId?: string; subject?: string; gradeId?: string; reason?: string }>(req);
    const subject = String(body.subject ?? "").trim();
    const reason = String(body.reason ?? "").trim();
    if (!subject || reason.length < 5) return apiErr(400, "درس و دلیل اعتراض (کمی کامل‌تر) لازم است.", "BAD_INPUT");
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p) return apiErr(404, "پروندهٔ دانش‌آموزی یافت نشد.", "NOT_FOUND");
      studentId = p.id;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    } else if (!(STAFF as readonly string[]).includes(me.role)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.gradeAppeal.create({
      data: { schoolId, studentId, requesterId: me.id, subject, gradeId: body.gradeId ? String(body.gradeId) : null, reason },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string; response?: string }>(req);
    const status = String(body.status ?? "");
    if (!["REVIEWING", "APPROVED", "REJECTED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.gradeAppeal.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "اعتراض یافت نشد.", "NOT_FOUND");
    if (found.status === "APPROVED" || found.status === "REJECTED") return apiErr(409, "این اعتراض قبلاً تعیین تکلیف شده است.", "DONE");
    const updated = await db.gradeAppeal.update({
      where: { id: found.id },
      data: { status, response: body.response ? String(body.response).trim() : found.response, handledById: me.id },
    });
    if (status !== "REVIEWING") {
      await notifyUser(found.requesterId, "IMPORTANT",
        status === "APPROVED" ? "اعتراض نمره پذیرفته شد" : "نتیجهٔ بررسی اعتراض نمره",
        `اعتراض شما برای درس ${found.subject}: ${status === "APPROVED" ? "پذیرفته شد و نمره بازبینی می‌شود" : "پس از بررسی پذیرفته نشد"}.${updated.response ? " " + updated.response : ""}`,
        "/app/grade-appeals", "APPEAL");
    }
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
