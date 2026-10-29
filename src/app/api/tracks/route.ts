import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor, demoWriteBlock} from "@/lib/api";

/* ============================================================
   بهار | مسیرهای تخصصی — آموزش عالی و فنی‌حرفه‌ای
   - رشته (HIGHER_ED / VOCATIONAL)، ثبت‌نام در رشته، پایان‌نامه،
     کارورزی و جلسهٔ کارگاه با حضوروغیاب
   - همهٔ ثبت‌ها به مدرسه و دانش‌آموز وصل‌اند؛ پایان‌نامه و
     کارورزی و کارگاه می‌توانند به یک رشته وصل باشند یا مستقل.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER"];

async function myStudentIds(me: { id: string; role: string }): Promise<string[]> {
  if (me.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
    return st ? [st.id] : [];
  }
  if (me.role === "PARENT") {
    return (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
  }
  return [];
}

async function studentNames(ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db.student.findMany({ where: { id: { in: ids } }, include: { user: { select: { firstName: true, lastName: true } } } });
  return new Map(rows.map((r) => [r.id, `${r.user.firstName} ${r.user.lastName}`]));
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const isStaff = STAFF.includes(me.role);
    const mine = isStaff ? [] : await myStudentIds(me);
    const scope = isStaff ? {} : { studentId: { in: mine } };
    const [programmes, enrollments, theses, internships, workshops] = await Promise.all([
      db.trackProgramme.findMany({ where: { schoolId }, include: { _count: { select: { enrollments: true } } }, orderBy: { name: "asc" } }),
      db.trackEnrollment.findMany({ where: { programme: { schoolId }, ...scope }, include: { programme: true }, orderBy: { createdAt: "desc" }, take: 200 }),
      db.thesis.findMany({ where: { schoolId, ...scope }, orderBy: { createdAt: "desc" }, take: 100 }),
      db.internship.findMany({ where: { schoolId, ...scope }, orderBy: { createdAt: "desc" }, take: 100 }),
      db.workshopSession.findMany({ where: { schoolId }, include: { _count: { select: { attendances: true } } }, orderBy: { date: "desc" }, take: 100 }),
    ]);
    const names = await studentNames([...new Set([...enrollments.map((e) => e.studentId), ...theses.map((t) => t.studentId), ...internships.map((i) => i.studentId)])]);
    return apiOk({
      programmes,
      enrollments: enrollments.map((e) => ({ ...e, studentName: names.get(e.studentId) ?? "—" })),
      theses: theses.map((t) => ({ ...t, studentName: names.get(t.studentId) ?? "—" })),
      internships: internships.map((i) => ({ ...i, studentName: names.get(i.studentId) ?? "—" })),
      workshops,
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
    const body = await readJson<{
      action?: string; id?: string; kind?: string; name?: string; field?: string; degreeLevel?: string; description?: string; startYear?: string;
      programmeId?: string; studentId?: string; title?: string; status?: string; grade?: number; note?: string; defenseDate?: string;
      workplace?: string; mentorName?: string; startDate?: string; endDate?: string; hoursTotal?: number; hoursDone?: number; evaluation?: string;
      date?: string; capacity?: number; location?: string; present?: boolean; sessionId?: string;
    }>(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");

    const programmeInSchool = async (pid?: string) => {
      if (!pid) return null;
      const p = await db.trackProgramme.findFirst({ where: { id: pid, schoolId }, select: { id: true } });
      if (!p) throw new Error("PROGRAMME_NOT_FOUND");
      return p;
    };
    const studentInSchool = async (sid: string) => {
      const st = await db.student.findFirst({ where: { id: sid, schoolId }, select: { id: true } });
      if (!st) throw new Error("STUDENT_NOT_FOUND");
      return st;
    };

    try {
      if (body.action === "createProgramme") {
        const kind = body.kind === "VOCATIONAL" ? "VOCATIONAL" : "HIGHER_ED";
        const name = String(body.name ?? "").trim();
        if (!name || name.length > 120) return apiErr(400, "نام رشته نامعتبر است.", "BAD_NAME");
        const programme = await db.trackProgramme.create({ data: { schoolId, kind, name, field: String(body.field ?? "").trim().slice(0, 60), degreeLevel: body.degreeLevel?.trim().slice(0, 40) || null, description: String(body.description ?? "").trim().slice(0, 500), startYear: String(body.startYear ?? "").trim().slice(0, 20) } });
        return apiOk({ programme });
      }
      if (body.action === "enroll") {
        const p = await programmeInSchool(body.programmeId);
        if (!p) return apiErr(404, "رشته یافت نشد.", "NOT_FOUND");
        await studentInSchool(String(body.studentId ?? ""));
        const existing = await db.trackEnrollment.findUnique({ where: { programmeId_studentId: { programmeId: p.id, studentId: String(body.studentId) } } });
        if (existing) return apiErr(409, "این دانش‌آموز قبلاً در این رشته ثبت شده است.", "DUPLICATE");
        const enrollment = await db.trackEnrollment.create({ data: { programmeId: p.id, studentId: String(body.studentId) } });
        return apiOk({ enrollment });
      }
      if (body.action === "createThesis") {
        await programmeInSchool(body.programmeId);
        await studentInSchool(String(body.studentId ?? ""));
        const title = String(body.title ?? "").trim();
        if (!title || title.length > 200) return apiErr(400, "عنوان پایان‌نامه نامعتبر است.", "BAD_TITLE");
        const thesis = await db.thesis.create({ data: { schoolId, programmeId: body.programmeId || null, studentId: String(body.studentId), title, note: String(body.note ?? "").trim().slice(0, 500) } });
        return apiOk({ thesis });
      }
      if (body.action === "updateThesis") {
        const thesis = await db.thesis.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
        if (!thesis) return apiErr(404, "پایان‌نامه یافت نشد.", "NOT_FOUND");
        const data: Record<string, unknown> = {};
        if (body.status && ["PROPOSAL", "IN_PROGRESS", "DEFENSE_SCHEDULED", "DEFENDED", "REJECTED"].includes(body.status)) data.status = body.status;
        if (body.grade !== undefined) { const g = Number(body.grade); if (Number.isFinite(g) && g >= 0 && g <= 20) data.grade = g; }
        if (body.defenseDate) { const d = new Date(body.defenseDate); if (!Number.isNaN(d.getTime())) data.defenseDate = d; }
        if (body.note !== undefined) data.note = String(body.note).trim().slice(0, 500);
        const updated = await db.thesis.update({ where: { id: thesis.id }, data });
        return apiOk({ thesis: updated });
      }
      if (body.action === "createInternship") {
        await programmeInSchool(body.programmeId);
        await studentInSchool(String(body.studentId ?? ""));
        const start = new Date(String(body.startDate ?? ""));
        const end = new Date(String(body.endDate ?? ""));
        const hours = Math.round(Number(body.hoursTotal ?? 0));
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start || hours <= 0) return apiErr(400, "بازه یا ساعات کارورزی نامعتبر است.", "BAD_INPUT");
        const internship = await db.internship.create({ data: { schoolId, programmeId: body.programmeId || null, studentId: String(body.studentId), workplace: String(body.workplace ?? "").trim().slice(0, 120), mentorName: String(body.mentorName ?? "").trim().slice(0, 80), startDate: start, endDate: end, hoursTotal: hours } });
        return apiOk({ internship });
      }
      if (body.action === "updateInternship") {
        const row = await db.internship.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
        if (!row) return apiErr(404, "کارورزی یافت نشد.", "NOT_FOUND");
        const data: Record<string, unknown> = {};
        if (body.hoursDone !== undefined) { const h = Math.round(Number(body.hoursDone)); if (h >= 0 && h <= row.hoursTotal) data.hoursDone = h; }
        if (body.status && ["PLANNED", "ONGOING", "COMPLETED", "CANCELED"].includes(body.status)) data.status = body.status;
        if (body.evaluation !== undefined) data.evaluation = String(body.evaluation).trim().slice(0, 500);
        const updated = await db.internship.update({ where: { id: row.id }, data });
        return apiOk({ internship: updated });
      }
      if (body.action === "createWorkshop") {
        await programmeInSchool(body.programmeId);
        const date = new Date(String(body.date ?? ""));
        const title = String(body.title ?? "").trim();
        if (Number.isNaN(date.getTime()) || !title) return apiErr(400, "عنوان یا تاریخ کارگاه نامعتبر است.", "BAD_INPUT");
        const workshop = await db.workshopSession.create({ data: { schoolId, programmeId: body.programmeId || null, title, date, capacity: Math.max(1, Math.round(Number(body.capacity ?? 30))), location: String(body.location ?? "").trim().slice(0, 120) } });
        return apiOk({ workshop });
      }
      if (body.action === "recordWorkshopAttendance") {
        const session = await db.workshopSession.findFirst({ where: { id: String(body.sessionId ?? ""), schoolId }, select: { id: true } });
        if (!session) return apiErr(404, "جلسهٔ کارگاه یافت نشد.", "NOT_FOUND");
        await studentInSchool(String(body.studentId ?? ""));
        const row = await db.workshopAttendance.upsert({
          where: { sessionId_studentId: { sessionId: session.id, studentId: String(body.studentId) } },
          create: { sessionId: session.id, studentId: String(body.studentId), present: body.present !== false },
          update: { present: body.present !== false },
        });
        return apiOk({ attendance: row });
      }
      return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
    } catch (e) {
      if (e instanceof Error && e.message === "PROGRAMME_NOT_FOUND") return apiErr(404, "رشته یافت نشد.", "NOT_FOUND");
      if (e instanceof Error && e.message === "STUDENT_NOT_FOUND") return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      throw e;
    }
  } catch (e) {
    return handleApiError(e);
  }
}
