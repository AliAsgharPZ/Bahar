import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | پروندهٔ بهداشت و درمانگاه (سبک) — کارت سلامت هر
   دانش‌آموز (گروه خون، حساسیت، بیماری زمینه‌ای، تماس اضطراری،
   واکسن‌ها) + لاگ مراجعه به درمانگاه؛ با ثبت مراجعه، ولی
   همان لحظه اعلان می‌گیرد.
   ============================================================ */

const STAFF = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "CUSTODIAN"];

async function resolveStudent(req: NextRequest, me: { id: string; role: string; schoolId?: string | null }, studentId: string) {
  if (me.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true, schoolId: true } });
    return st && (!studentId || st.id === studentId) ? st : null;
  }
  if (me.role === "PARENT") {
    const link = await db.studentParent.findFirst({
      where: { parentUserId: me.id, ...(studentId ? { studentId } : {}) },
      select: { student: { select: { id: true, schoolId: true } } },
    });
    return link?.student ?? null;
  }
  const schoolId = me.schoolId ?? actingSchoolIdFor(req, me as never) ?? null;
  if (!schoolId || !studentId) return null;
  return db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, schoolId: true } });
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
    const st = await resolveStudent(req, me, studentId);
    if (!st) return apiOk({ health: null, visits: [] });
    const [health, visits] = await Promise.all([
      db.studentHealth.findUnique({ where: { studentId: st.id } }),
      db.clinicVisit.findMany({ where: { studentId: st.id }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return apiOk({ health, visits });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      action?: string; studentId?: string; bloodType?: string; allergies?: string;
      conditions?: string; emergencyContact?: string; vaccinations?: { name: string; date?: string; done: boolean }[];
      date?: string; complaint?: string; visitAction?: string; sentHome?: boolean; notifyParent?: boolean;
    }>(req);
    const studentId = String(body.studentId ?? "");
    const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    if (body.action === "saveHealth") {
      const vaccinations = JSON.stringify((body.vaccinations ?? []).slice(0, 30).map((v) => ({
        name: String(v.name ?? "").slice(0, 60), date: String(v.date ?? "").slice(0, 20), done: !!v.done,
      })));
      const health = await db.studentHealth.upsert({
        where: { studentId },
        create: {
          schoolId, studentId,
          bloodType: body.bloodType?.trim().slice(0, 8) || null,
          allergies: body.allergies?.trim().slice(0, 500) || null,
          conditions: body.conditions?.trim().slice(0, 500) || null,
          emergencyContact: body.emergencyContact?.trim().slice(0, 120) || null,
          vaccinations, updatedById: me.id,
        },
        update: {
          bloodType: body.bloodType?.trim().slice(0, 8) || null,
          allergies: body.allergies?.trim().slice(0, 500) || null,
          conditions: body.conditions?.trim().slice(0, 500) || null,
          emergencyContact: body.emergencyContact?.trim().slice(0, 120) || null,
          vaccinations, updatedById: me.id,
        },
      });
      return apiOk({ health });
    }

    if (body.action === "visit") {
      const complaint = (body.complaint ?? "").trim();
      if (complaint.length < 3) return apiErr(400, "علت مراجعه را بنویسید.", "BAD_INPUT");
      const date = /^\d{4}-\d{2}-\d{2}$/.test(body.date ?? "") ? body.date! : "";
      if (!date) return apiErr(400, "تاریخ را مثل 1405-08-05 بنویسید.", "BAD_DATE");
      const visit = await db.clinicVisit.create({
        data: {
          schoolId, studentId, date, complaint: complaint.slice(0, 300),
          action: body.visitAction?.trim().slice(0, 300) || null,
          sentHome: !!body.sentHome, notifyParent: body.notifyParent !== false,
          createdById: me.id,
        },
      });
      if (visit.notifyParent) {
        const links = await db.studentParent.findMany({ where: { studentId }, select: { parentUserId: true } });
        const stUser = await db.student.findUnique({ where: { id: studentId }, select: { userId: true } });
        const targets = [...links.map((l) => l.parentUserId), ...(stUser ? [stUser.userId] : [])];
        if (targets.length) {
          await db.notification.createMany({
            data: targets.map((uid) => ({
              userId: uid, kind: "HEALTH", category: "IMPORTANT",
              title: "مراجعه به درمانگاه مدرسه",
              body: `${complaint.slice(0, 120)}${body.visitAction ? ` — اقدام: ${body.visitAction.slice(0, 100)}` : ""}`,
              link: "/app/health",
            })),
          });
        }
      }
      return apiOk({ visit });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const kind = url.searchParams.get("kind") ?? "visit";
    if (kind === "profile") {
      const studentId = url.searchParams.get("studentId") ?? "";
      const row = await db.studentHealth.findUnique({ where: { studentId }, select: { schoolId: true } });
      if (!row) return apiErr(404, "پرونده یافت نشد.", "NOT_FOUND");
      if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.studentHealth.delete({ where: { studentId } });
      return apiOk({ ok: true });
    }
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.clinicVisit.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "مراجعه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.clinicVisit.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
