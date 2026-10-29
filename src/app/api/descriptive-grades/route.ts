import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor, demoWriteBlock} from "@/lib/api";

/* ============================================================
   بهار | کارنامهٔ توصیفی (ابتدایی) — ارزیابی کیفی هر شایستگی
   در مقیاس چهار‌سطحی: خیلی خوب / خوب / قابل قبول / نیاز به
   تلاش بیشتر؛ ولی و دانش‌آموز نمای تجمیعی را می‌بینند.
   ============================================================ */

const LEVELS = ["VERY_GOOD", "GOOD", "ACCEPTABLE", "NEEDS_WORK"];
const STAFF = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";

    if (me.role === "STUDENT" || me.role === "PARENT") {
      const allowed = me.role === "STUDENT"
        ? [(await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id]
        : (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
      const target = studentId && allowed.includes(studentId) ? studentId : allowed[0];
      if (!target) return apiOk({ rows: [] });
      const rows = await db.descriptiveGrade.findMany({
        where: { studentId: target },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        orderBy: [{ term: "asc" }, { createdAt: "asc" }],
      });
      const subjects = new Map(
        (await db.subject.findMany({ where: { id: { in: rows.map((r) => r.subjectId).filter(Boolean) as string[] } }, select: { id: true, name: true } }))
          .map((s) => [s.id, s.name]),
      );
      return apiOk({
        rows: rows.map((r) => ({ ...r, subjectName: r.subjectId ? subjects.get(r.subjectId) ?? "" : "" })),
      });
    }

    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    if (!studentId) return apiOk({ rows: [] });
    const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const rows = await db.descriptiveGrade.findMany({
      where: { studentId },
      orderBy: [{ term: "asc" }, { createdAt: "asc" }],
    });
    const subjects = new Map(
      (await db.subject.findMany({ where: { schoolId }, select: { id: true, name: true } })).map((s) => [s.id, s.name]),
    );
    return apiOk({ rows: rows.map((r) => ({ ...r, subjectName: r.subjectId ? subjects.get(r.subjectId) ?? "" : "" })) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ action?: string; id?: string; studentId?: string; subjectId?: string; competency?: string; level?: string; term?: number; note?: string }>(req);

    if (body.action === "delete") {
      await db.descriptiveGrade.deleteMany({ where: { id: String(body.id ?? ""), schoolId } });
      return apiOk({ ok: true });
    }
    const studentId = String(body.studentId ?? "");
    const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const competency = (body.competency ?? "").trim();
    if (competency.length < 3) return apiErr(400, "متن شایستگی را بنویسید.", "BAD_INPUT");
    if (!LEVELS.includes(body.level ?? "")) return apiErr(400, "سطح ارزیابی نامعتبر است.", "BAD_LEVEL");
    const row = await db.descriptiveGrade.create({
      data: {
        schoolId, studentId, subjectId: body.subjectId || null,
        competency: competency.slice(0, 300), level: body.level!,
        term: [1, 2].includes(Number(body.term)) ? Number(body.term) : 1,
        note: body.note?.trim().slice(0, 500) || null, createdById: me.id,
      },
    });
    return apiOk({ row });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.descriptiveGrade.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.descriptiveGrade.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
