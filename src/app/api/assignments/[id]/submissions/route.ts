import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit } from "@/lib/api";

/* ============================================================
   بهار | تحویل تکلیف — دانش‌آموز تحویل می‌دهد و رسید زمان‌دار
   با کد یکتا می‌گیرد؛ معلم فهرست تحویل‌ها، غایبان و معاف‌ها را
   می‌بیند و می‌تواند دانش‌آموزی را معاف کند.
   ============================================================ */

type Ctx = { params: Promise<{ id: string }> };

async function loadAssignment(id: string) {
  return db.assignment.findUnique({
    where: { id },
    include: { class: { select: { id: true, schoolId: true, name: true } } },
  });
}

function targetsOf(a: { targetStudentIds: string }): string[] {
  try { return JSON.parse(a.targetStudentIds || "[]") as string[]; } catch { return []; }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const a = await loadAssignment(id);
    if (!a) return apiErr(404, "تکلیف یافت نشد.", "NOT_FOUND");

    if (me.role === "STUDENT") {
      const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true, classId: true } });
      if (!st || st.classId !== a.classId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const mine = await db.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId: st.id } } });
      return apiOk({ mine });
    }

    // کارکنان همان مدرسه: فهرست کامل گیرندگان با وضعیت هرکدام
    const schoolId = a.class.schoolId;
    if (me.schoolId && me.schoolId !== schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const targets = targetsOf(a);
    const roster = await db.student.findMany({
      where: { classId: a.classId, status: "ACTIVE", ...(targets.length ? { id: { in: targets } } : {}) },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { lastName: "asc" } },
    });
    const subs = await db.assignmentSubmission.findMany({ where: { assignmentId: a.id } });
    const byStudent = new Map(subs.map((s) => [s.studentId, s]));
    return apiOk({
      roster: roster.map((s) => ({
        student: { id: s.id, firstName: s.user.firstName, lastName: s.user.lastName },
        submission: byStudent.get(s.id) ?? null,
      })),
      counts: {
        total: roster.length,
        submitted: subs.filter((s) => s.status === "SUBMITTED" || s.status === "LATE").length,
        late: subs.filter((s) => s.status === "LATE").length,
        exempt: subs.filter((s) => s.status === "EXEMPT").length,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const a = await loadAssignment(id);
    if (!a) return apiErr(404, "تکلیف یافت نشد.", "NOT_FOUND");
    const body = await readJson<{ action?: string; content?: string; studentId?: string }>(req);

    if (body.action === "submit") {
      if (me.role !== "STUDENT") return apiErr(403, "فقط دانش‌آموز تحویل می‌دهد.", "FORBIDDEN");
      const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true, classId: true, schoolId: true } });
      if (!st || st.classId !== a.classId) return apiErr(403, "این تکلیف برای کلاس شما نیست.", "FORBIDDEN");
      const targets = targetsOf(a);
      if (targets.length && !targets.includes(st.id)) return apiErr(403, "این تکلیف برای شما تعیین نشده است.", "FORBIDDEN");
      const existing = await db.assignmentSubmission.findUnique({ where: { assignmentId_studentId: { assignmentId: a.id, studentId: st.id } } });
      if (existing?.status === "EXEMPT") return apiErr(409, "شما از این تکلیف معاف شده‌اید.", "EXEMPT");
      const late = new Date() > a.dueDate;
      const submission = await db.assignmentSubmission.upsert({
        where: { assignmentId_studentId: { assignmentId: a.id, studentId: st.id } },
        create: {
          assignmentId: a.id, studentId: st.id,
          content: (body.content ?? "").slice(0, 5000),
          status: late ? "LATE" : "SUBMITTED",
          receiptCode: randomBytes(4).toString("hex").toUpperCase(),
        },
        update: {
          content: (body.content ?? "").slice(0, 5000),
          status: late ? "LATE" : "SUBMITTED",
          submittedAt: new Date(),
        },
      });
      await audit({ user: me, action: "تحویل تکلیف", entityType: "AssignmentSubmission", entityId: submission.id, schoolId: st.schoolId });
      return apiOk({ submission, receipt: { code: submission.receiptCode, at: submission.submittedAt, late } });
    }

    if (body.action === "exempt" || body.action === "unexempt") {
      if (!["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (me.schoolId && me.schoolId !== a.class.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const studentId = String(body.studentId ?? "");
      const st = await db.student.findFirst({ where: { id: studentId, classId: a.classId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      if (body.action === "exempt") {
        const submission = await db.assignmentSubmission.upsert({
          where: { assignmentId_studentId: { assignmentId: a.id, studentId } },
          create: { assignmentId: a.id, studentId, content: "", status: "EXEMPT", receiptCode: "EXEMPT" },
          update: { status: "EXEMPT" },
        });
        return apiOk({ submission });
      }
      await db.assignmentSubmission.deleteMany({ where: { assignmentId: a.id, studentId, status: "EXEMPT" } });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
