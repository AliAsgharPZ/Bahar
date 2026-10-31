import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;
const KINDS = ["ENROLLMENT_CERT", "TRANSCRIPT", "INTRODUCTION", "OTHER"] as const;
const STATUSES = ["PENDING", "READY", "DELIVERED", "REJECTED"] as const;

const KIND_FA: Record<string, string> = {
  ENROLLMENT_CERT: "گواهی اشتغال به تحصیل",
  TRANSCRIPT: "ریز نمرات",
  INTRODUCTION: "معرفی‌نامه",
  OTHER: "مدرک دیگر",
};

/**
 * GET /api/document-requests — دفتر: صف درخواست‌ها؛ دانش‌آموز/ولی: درخواست‌های خودشان
 * POST /api/document-requests — ثبت درخواست (دانش‌آموز برای خودش، ولی برای فرزندش)
 * PATCH /api/document-requests { id, status, staffNote? } — رسیدگی دفتر + اعلان به درخواست‌دهنده
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const status = req.nextUrl.searchParams.get("status");
    const rows = await db.documentRequest.findMany({
      where: {
        schoolId,
        ...(isOffice ? {} : { requesterId: me.id }),
        ...(status && (STATUSES as readonly string[]).includes(status) ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        student: { select: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } }, studentNumber: true } },
      },
    });
    const requesterIds = [...new Set(rows.map((r) => r.requesterId))];
    const requesters = requesterIds.length
      ? await db.user.findMany({ where: { id: { in: requesterIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
      : [];
    const byId = new Map(requesters.map((u) => [u.id, u]));
    let myStudents: { id: string; name: string }[] = [];
    if (!isOffice) {
      if (me.role === "STUDENT") {
        const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true, user: { select: { firstName: true, lastName: true } } } });
        if (profile) myStudents = [{ id: profile.id, name: `${profile.user.firstName} ${profile.user.lastName}` }];
      } else if (me.role === "PARENT" || me.role === "CUSTODIAN") {
        const links = await db.studentParent.findMany({
          where: { parentUserId: me.id },
          include: { student: { select: { id: true, user: { select: { firstName: true, lastName: true } } } } },
        });
        myStudents = links.map((l) => ({ id: l.student.id, name: `${l.student.user.firstName} ${l.student.user.lastName}` }));
      }
    }
    return apiOk({
      isOffice,
      myStudents,
      pendingCount: isOffice ? await db.documentRequest.count({ where: { schoolId, status: "PENDING" } }) : 0,
      items: rows.map((r) => ({
        id: r.id, kind: r.kind, kindFa: KIND_FA[r.kind] ?? r.kind, purpose: r.purpose, status: r.status,
        staffNote: r.staffNote, createdAt: r.createdAt, readyAt: r.readyAt,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        studentNumber: r.student.studentNumber,
        className: r.student.class?.name ?? null,
        requester: byId.get(r.requesterId) ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["STUDENT", "PARENT", "CUSTODIAN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; kind?: string; purpose?: string }>(req);
    const kind = String(body.kind ?? "");
    if (!(KINDS as readonly string[]).includes(kind)) return apiErr(400, "نوع مدرک نامعتبر است.", "BAD_KIND");
    const studentId = String(body.studentId ?? "");
    if (me.role === "STUDENT") {
      const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!profile || profile.id !== studentId) return apiErr(403, "فقط برای خودتان می‌توانید درخواست بدهید.", "FORBIDDEN");
    } else {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.documentRequest.create({
      data: { schoolId, studentId, requesterId: me.id, kind, purpose: body.purpose ? String(body.purpose).trim().slice(0, 500) : null },
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
    const body = await readJson<{ id?: string; status?: string; staffNote?: string }>(req);
    const status = String(body.status ?? "");
    if (!(STATUSES as readonly string[]).includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const found = await db.documentRequest.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    const updated = await db.documentRequest.update({
      where: { id: found.id },
      data: {
        status,
        staffNote: body.staffNote !== undefined ? String(body.staffNote).trim().slice(0, 500) || null : found.staffNote,
        handledById: me.id,
        readyAt: status === "READY" ? new Date() : found.readyAt,
      },
    });
    const kindFa = KIND_FA[found.kind] ?? "مدرک";
    if (status === "READY") await notifyUser(found.requesterId, "IMPORTANT", "مدرک شما آماده است", `«${kindFa}» آمادهٔ تحویل از دفتر مدرسه است.`, "/app/document-requests", "DOCUMENT");
    if (status === "DELIVERED") await notifyUser(found.requesterId, "INFO", "مدرک تحویل داده شد", `«${kindFa}» تحویل داده شد.`, "/app/document-requests", "DOCUMENT");
    if (status === "REJECTED") await notifyUser(found.requesterId, "IMPORTANT", "درخواست مدرک رد شد", `درخواست «${kindFa}» رد شد.${updated.staffNote ? ` دلیل: ${updated.staffNote}` : ""}`, "/app/document-requests", "DOCUMENT");
    await audit({ user: me, action: "DOCUMENT_REQUEST_HANDLE", entityType: "DOCUMENT_REQUEST", entityId: found.id, meta: { status }, schoolId });
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
