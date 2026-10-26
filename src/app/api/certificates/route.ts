import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, requireSchoolId } from "@/lib/api";
import { randomBytes } from "crypto";

/* ============================================================
   بهار | گواهی‌ها — قالب‌ها، صدور با سریال/کد استعلام، ابطال
   ============================================================ */

const KIND_LABELS: Record<string, string> = {
  ENROLLMENT: "گواهی تحصیل", BONAFIDE: "گواهی اشتغال به تحصیل", ACHIEVEMENT: "گواهی افتخار",
  TRANSFER: "گواهی انتقال", CUSTOM: "سفارشی",
};

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "—");
}

/** GET /api/certificates — قالب‌ها + صادرشده‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = requireSchoolId(me);
    const [templates, certs] = await Promise.all([
      db.certificateTemplate.findMany({ where: { schoolId }, orderBy: { kind: "asc" } }),
      db.certificate.findMany({
        where: { schoolId },
        orderBy: { issuedAt: "desc" },
        take: 100,
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true, nationalId: true } }, class: { select: { name: true } } } },
        },
      }),
    ]);
    const students = await db.student.findMany({
      where: { schoolId, user: { isActive: true } },
      include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
      take: 500,
    });
    // ابطال فقط مدیر/سوپرادمین — تا دکمه در UI معاون نمایش داده نشود
    return apiOk({ templates, certs, students, kindLabels: KIND_LABELS, canRevoke: me.role === "MANAGER" || me.role === "SUPER_ADMIN" });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/certificates — قالب جدید یا صدور گواهی */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    if (action === "template") {
      const title = String(body.title ?? "").trim();
      const bodyTemplate = String(body.bodyTemplate ?? "").trim();
      if (!title || !bodyTemplate) return apiErr(400, "عنوان و متن قالب لازم است.", "BAD_REQUEST");
      const t = await db.certificateTemplate.create({
        data: {
          schoolId,
          kind: KIND_LABELS[String(body.kind)] ? String(body.kind) : "CUSTOM",
          title,
          bodyTemplate,
          footerNote: (body.footerNote as string) ?? null,
        },
      });
      await audit({ user: me, action: "ایجاد قالب گواهی", entityType: "CertificateTemplate", entityId: t.id, schoolId });
      return apiOk({ template: t });
    }

    if (action === "issue") {
      const studentId = String(body.studentId ?? "");
      const student = await db.student.findUnique({
        where: { id: studentId },
        include: { user: true, class: true },
      });
      if (!student || student.schoolId !== schoolId) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const school = await db.school.findUnique({ where: { id: schoolId } });
      let title = String(body.title ?? "").trim();
      let text = String(body.body ?? "").trim();
      let templateId: string | null = null;
      if (body.templateId) {
        const t = await db.certificateTemplate.findUnique({ where: { id: String(body.templateId) } });
        if (t && t.schoolId === schoolId) {
          templateId = t.id;
          title = title || t.title;
          text = fillTemplate(t.bodyTemplate, {
            student_name: `${student.user.firstName} ${student.user.lastName}`,
            father_name: student.user.fatherName ?? "—",
            national_id: student.user.nationalId,
            student_number: student.studentNumber,
            class_name: student.class?.name ?? "—",
            grade: student.class?.grade ?? "—",
            school_name: school?.name ?? "—",
            date_fa: new Date().toLocaleDateString("fa-IR"),
          });
        }
      }
      if (!title || !text) return apiErr(400, "عنوان و متن گواهی لازم است.", "BAD_REQUEST");
      const serial = `BH-${school?.code ?? "X"}-${Date.now().toString(36).toUpperCase()}`;
      const verifyCode = randomBytes(5).toString("hex").toUpperCase();
      const cert = await db.certificate.create({
        data: {
          schoolId, studentId, templateId,
          kind: KIND_LABELS[String(body.kind)] ? String(body.kind) : "CUSTOM",
          title, body: text, serial, verifyCode, issuedById: me.id,
          note: (body.note as string) ?? null,
        },
      });
      await audit({ user: me, action: "صدور گواهی", entityType: "Certificate", entityId: cert.id, schoolId, meta: { serial, studentId } });
      return apiOk({ certificate: cert, verifyUrl: `/verify/${verifyCode}` });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/certificates — ابطال گواهی */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; revoke?: boolean }>(req);
    if (!body.id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const cert = await db.certificate.findUnique({ where: { id: body.id } });
    if (!cert || cert.schoolId !== schoolId) return apiErr(404, "گواهی یافت نشد.", "NOT_FOUND");
    await db.certificate.update({
      where: { id: body.id },
      data: { revokedAt: body.revoke === false ? null : new Date() },
    });
    await audit({ user: me, action: body.revoke === false ? "بازگشایی گواهی" : "ابطال گواهی", entityType: "Certificate", entityId: body.id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/certificates?id= (قالب) */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const url = new URL(req.url);
    const templateId = url.searchParams.get("template");
    if (templateId) {
      const del = await db.certificateTemplate.deleteMany({ where: { id: templateId, schoolId } });
      if (del.count === 0) return apiErr(404, "قالب یافت نشد.", "NOT_FOUND");
      await audit({ user: me, action: "حذف قالب گواهی", entityType: "CERT_TEMPLATE", entityId: templateId, schoolId });
      return apiOk({ ok: true });
    }
    return apiErr(400, "شناسه قالب لازم است.", "BAD_REQUEST");
  } catch (e) {
    return handleApiError(e);
  }
}
