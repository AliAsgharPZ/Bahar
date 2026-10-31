import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyMany } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

async function targetStudents(schoolId: string, classId: string | null) {
  return db.student.findMany({
    where: { schoolId, status: "ACTIVE", ...(classId ? { classId } : {}) },
    select: {
      id: true,
      classId: true,
      user: { select: { firstName: true, lastName: true } },
      class: { select: { name: true } },
      parents: { select: { parentUserId: true, parentUser: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { studentNumber: "asc" },
  });
}

/**
 * GET /api/consents — کارکنان: فهرست رضایت‌نامه‌ها با شمارش پاسخ‌ها؛ ?id= → فهرست کامل دانش‌آموزان و پاسخ‌ها
 *                     ولی: رضایت‌نامه‌هایی که فرزندانش را هدف گرفته‌اند + وضعیت پاسخ خودش
 * POST /api/consents — ساخت رضایت‌نامه (کارکنان) + اعلان به اولیای دانش‌آموزان هدف
 * DELETE /api/consents?id= — حذف (کارکنان)
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const id = req.nextUrl.searchParams.get("id");

    if ((STAFF as readonly string[]).includes(me.role)) {
      const schoolId = requireSchoolId(me);
      if (id) {
        const request = await db.consentRequest.findFirst({ where: { id, schoolId } });
        if (!request) return apiErr(404, "رضایت‌نامه یافت نشد.", "NOT_FOUND");
        const [targets, responses, school] = await Promise.all([
          targetStudents(schoolId, request.classId),
          db.consentResponse.findMany({ where: { requestId: id } }),
          db.school.findUnique({ where: { id: schoolId }, select: { name: true } }),
        ]);
        const byStudent = new Map(responses.map((r) => [r.studentId, r]));
        return apiOk({
          request,
          schoolName: school?.name ?? null,
          roster: targets.map((s) => {
            const r = byStudent.get(s.id);
            return {
              studentId: s.id,
              studentName: `${s.user.firstName} ${s.user.lastName}`,
              className: s.class?.name ?? null,
              parents: s.parents.map((p) => `${p.parentUser.firstName} ${p.parentUser.lastName}`),
              status: r?.status ?? "PENDING",
              note: r?.note ?? null,
              respondedAt: r?.updatedAt ?? null,
            };
          }),
        });
      }
      const requests = await db.consentRequest.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { responses: true } }, responses: { select: { status: true } } },
      });
      const out: Record<string, unknown>[] = [];
      for (const r of requests) {
        const targets = await db.student.count({ where: { schoolId, status: "ACTIVE", ...(r.classId ? { classId: r.classId } : {}) } });
        out.push({
          id: r.id, title: r.title, body: r.body, classId: r.classId, eventId: r.eventId, deadline: r.deadline, createdAt: r.createdAt,
          targets,
          approved: r.responses.filter((x) => x.status === "APPROVED").length,
          declined: r.responses.filter((x) => x.status === "DECLINED").length,
        });
      }
      const classes = await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } });
      return apiOk({ requests: out, classes });
    }

    if (me.role === "PARENT" || me.role === "CUSTODIAN") {
      const links = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: { student: { select: { id: true, schoolId: true, classId: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
      });
      if (!links.length) return apiOk({ items: [] });
      const schoolId = links[0].student.schoolId;
      const requests = await db.consentRequest.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 50 });
      const myResponses = await db.consentResponse.findMany({ where: { parentUserId: me.id } });
      const byKey = new Map(myResponses.map((r) => [`${r.requestId}:${r.studentId}`, r]));
      const items: Record<string, unknown>[] = [];
      for (const r of requests) {
        for (const l of links) {
          if (r.classId && r.classId !== l.student.classId) continue;
          const resp = byKey.get(`${r.id}:${l.student.id}`);
          items.push({
            requestId: r.id,
            title: r.title,
            body: r.body,
            deadline: r.deadline,
            studentId: l.student.id,
            studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
            className: l.student.class?.name ?? null,
            status: resp?.status ?? "PENDING",
            note: resp?.note ?? null,
          });
        }
      }
      return apiOk({ items });
    }
    return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ title?: string; body?: string; classId?: string; eventId?: string; deadline?: string }>(req);
    const title = String(body.title ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (!title || text.length < 10) return apiErr(400, "عنوان و متن کامل رضایت‌نامه لازم است.", "BAD_INPUT");
    let classId: string | null = null;
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: String(body.classId), schoolId }, select: { id: true } });
      if (!cls) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
      classId = cls.id;
    }
    let eventId: string | null = null;
    if (body.eventId) {
      const ev = await db.schoolEvent.findFirst({ where: { id: String(body.eventId), schoolId }, select: { id: true } });
      if (ev) eventId = ev.id;
    }
    const created = await db.consentRequest.create({
      data: { schoolId, title, body: text, classId, eventId, deadline: body.deadline ? String(body.deadline) : null, createdById: me.id },
    });
    const targets = await targetStudents(schoolId, classId);
    const parentIds = [...new Set(targets.flatMap((s) => s.parents.map((p) => p.parentUserId)))];
    if (parentIds.length) {
      await notifyMany(parentIds, "IMPORTANT", "رضایت‌نامهٔ تازه", `«${title}» — لطفاً در بخش رضایت‌نامه‌ها مطالعه و تأیید یا رد کنید.`, "/app/consents", "CONSENT");
    }
    await audit({ user: me, action: "CREATE_CONSENT", entityType: "CONSENT", entityId: created.id, meta: { targets: targets.length }, schoolId });
    return apiOk({ id: created.id, targets: targets.length, notifiedParents: parentIds.length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.consentRequest.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "رضایت‌نامه یافت نشد.", "NOT_FOUND");
    await db.consentRequest.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_CONSENT", entityType: "CONSENT", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
