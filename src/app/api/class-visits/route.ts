import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/class-visits — درخواست‌های بازدید اولیا از کلاس؛ POST: ولی ثبت می‌کند، PATCH: دفتر تأیید/رد + خبر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const rows = await db.classVisit.findMany({
      where: { schoolId, ...(isOffice ? {} : { parentUserId: me.id }) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({ isOffice, items: rows });
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
    const body = await readJson<{ studentId?: string; date?: string; reason?: string }>(req);
    const date = String(body.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiErr(400, "تاریخ بازدید را مثل 1404-08-15 بنویسید.", "BAD_DATE");
    let classId: string | null = null;
    if (body.studentId) {
      if (me.role === "PARENT") {
        const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId: String(body.studentId) } });
        if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
      }
      const st = await db.student.findFirst({ where: { id: String(body.studentId), schoolId }, select: { classId: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      classId = st.classId;
    }
    const created = await db.classVisit.create({
      data: {
        schoolId, parentUserId: me.id, parentName: `${me.firstName} ${me.lastName}`,
        studentId: body.studentId ? String(body.studentId) : null,
        classId, date,
        reason: body.reason ? String(body.reason).trim() : null,
      },
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
    const found = await db.classVisit.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    const updated = await db.classVisit.update({ where: { id: found.id }, data: { status, handledById: me.id } });
    await notifyUser(found.parentUserId, status === "APPROVED" ? "SUCCESS" : "INFO",
      status === "APPROVED" ? "بازدید از کلاس تأیید شد" : "بازدید از کلاس رد شد",
      `درخواست بازدید شما برای ${found.date}: ${status === "APPROVED" ? "تأیید شد؛ لطفاً روز بازدید به دفتر مراجعه کنید" : "متأسفانه رد شد"}.`,
      "/app/class-visits", "VISIT");
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
