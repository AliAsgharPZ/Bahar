import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | فرم‌ساز مدرسه — رضایت‌نامه اردو، ثبت‌نام و نظرسنجی
   ساختاری برای ولی/دانش‌آموز؛ تعریف فیلدها JSON، پاسخ‌ها JSON
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];
const FIELD_TYPES = ["text", "textarea", "select", "checkbox", "number"] as const;

export type FormField = { key: string; label: string; type: string; required?: boolean; options?: string[] };

export function parseFields(raw: string): FormField[] {
  try {
    const arr = JSON.parse(raw) as FormField[];
    return Array.isArray(arr) ? arr.filter((f) => f && f.key && f.label) : [];
  } catch { return []; }
}

function cleanFields(input: unknown): FormField[] | null {
  if (!Array.isArray(input) || !input.length || input.length > 30) return null;
  const out: FormField[] = [];
  const seen = new Set<string>();
  for (const f of input as Array<Record<string, unknown>>) {
    const key = String(f.key ?? "").trim().slice(0, 40);
    const label = String(f.label ?? "").trim().slice(0, 120);
    const type = String(f.type ?? "text");
    if (!key || !label || seen.has(key) || !FIELD_TYPES.includes(type as (typeof FIELD_TYPES)[number])) return null;
    seen.add(key);
    out.push({
      key, label, type,
      required: !!f.required,
      options: type === "select" ? (Array.isArray(f.options) ? f.options.map((o) => String(o).slice(0, 60)).filter(Boolean).slice(0, 20) : []) : undefined,
    });
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");

    if (STAFF.includes(me.role)) {
      const forms = await db.schoolForm.findMany({
        where: { schoolId },
        include: { _count: { select: { submissions: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      return apiOk({ staff: true, forms: forms.map((f) => ({ ...f, fields: parseFields(f.fields) })) });
    }

    // مخاطب: فرم‌های بازِ هم‌خوان با نقش و کلاس
    let myClassId: string | null = null;
    let myStudentIds: string[] = [];
    if (me.role === "STUDENT") {
      const st = await db.student.findFirst({ where: { userId: me.id, schoolId }, select: { id: true, classId: true } });
      if (st) { myClassId = st.classId; myStudentIds = [st.id]; }
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      myStudentIds = links.map((l) => l.studentId);
    } else {
      return apiOk({ staff: false, forms: [], myStudentIds: [] });
    }
    const audienceOk = me.role === "PARENT" ? ["PARENTS", "ALL"] : ["STUDENTS", "ALL"];
    const forms = await db.schoolForm.findMany({
      where: { schoolId, status: "OPEN", audience: { in: audienceOk } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const visible = forms.filter((f) => !f.classId || (me.role === "STUDENT" ? f.classId === myClassId : true));
    const subs = myStudentIds.length
      ? await db.formSubmission.findMany({ where: { formId: { in: visible.map((f) => f.id) }, studentId: { in: myStudentIds } }, select: { formId: true, studentId: true } })
      : [];
    const submittedFor = new Set(subs.map((s) => `${s.formId}:${s.studentId}`));
    return apiOk({
      staff: false,
      myStudentIds,
      forms: visible.map((f) => ({ ...f, fields: parseFields(f.fields), submittedStudentIds: myStudentIds.filter((sid) => submittedFor.has(`${f.id}:${sid}`)) })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      title?: string; description?: string; fields?: unknown; audience?: string; classId?: string; deadline?: string;
    }>(req);
    const title = (body.title ?? "").trim().slice(0, 120);
    if (!title) return apiErr(400, "عنوان فرم الزامی است.", "BAD_TITLE");
    const fields = cleanFields(body.fields);
    if (!fields) return apiErr(400, "فیلدهای فرم نامعتبر است.", "BAD_FIELDS");
    const audience = ["PARENTS", "STUDENTS", "ALL"].includes(String(body.audience)) ? String(body.audience) : "PARENTS";
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NO_CLASS");
    }
    const form = await db.schoolForm.create({
      data: {
        schoolId, title,
        description: body.description?.trim().slice(0, 1000) || null,
        fields: JSON.stringify(fields),
        audience,
        classId: body.classId || null,
        deadline: body.deadline?.slice(0, 10) || null,
        createdById: me.id,
      },
    });
    await audit({ user: me, action: "ساخت فرم", entityType: "SchoolForm", entityId: form.id, schoolId });
    return apiOk({ form: { ...form, fields } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ id?: string; status?: string }>(req);
    const form = await db.schoolForm.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!form) return apiErr(404, "فرم یافت نشد.", "NOT_FOUND");
    const status = body.status === "CLOSED" ? "CLOSED" : "OPEN";
    const updated = await db.schoolForm.update({ where: { id: form.id }, data: { status } });
    return apiOk({ form: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const form = await db.schoolForm.findFirst({ where: { id, schoolId } });
    if (!form) return apiErr(404, "فرم یافت نشد.", "NOT_FOUND");
    await db.schoolForm.delete({ where: { id: form.id } });
    await audit({ user: me, action: "حذف فرم", entityType: "SchoolForm", entityId: form.id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
