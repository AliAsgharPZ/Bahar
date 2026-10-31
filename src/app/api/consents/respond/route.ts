import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock } from "@/lib/api";

/** POST /api/consents/respond — پاسخ ولی (تأیید/رد) برای یک دانش‌آموز */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["PARENT", "CUSTODIAN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ requestId?: string; studentId?: string; status?: string; note?: string }>(req);
    const status = String(body.status ?? "");
    if (!["APPROVED", "DECLINED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const requestId = String(body.requestId ?? "");
    const studentId = String(body.studentId ?? "");
    const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
    if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    const request = await db.consentRequest.findUnique({ where: { id: requestId } });
    if (!request) return apiErr(404, "رضایت‌نامه یافت نشد.", "NOT_FOUND");
    const student = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true, classId: true } });
    if (!student || student.schoolId !== request.schoolId) return apiErr(403, "دانش‌آموز در این مدرسه نیست.", "FORBIDDEN");
    if (request.classId && request.classId !== student.classId) return apiErr(403, "این رضایت‌نامه برای کلاس فرزند شما نیست.", "FORBIDDEN");
    const saved = await db.consentResponse.upsert({
      where: { requestId_studentId: { requestId, studentId } },
      create: { requestId, studentId, parentUserId: me.id, status, note: body.note ? String(body.note).slice(0, 500) : null },
      update: { parentUserId: me.id, status, note: body.note ? String(body.note).slice(0, 500) : null },
    });
    return apiOk({ id: saved.id, status: saved.status });
  } catch (e) {
    return handleApiError(e);
  }
}
