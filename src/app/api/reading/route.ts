import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/reading — دفتر کتاب‌های من + جدول برترین کتاب‌خوان‌های مدرسه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    let myStudentId: string | null = null;
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      myStudentId = p?.id ?? null;
    }
    const mine = myStudentId
      ? await db.readingLog.findMany({ where: { schoolId, studentId: myStudentId }, orderBy: { createdAt: "desc" }, take: 100 })
      : [];
    const finished = await db.readingLog.findMany({ where: { schoolId, finished: true }, select: { studentId: true, pages: true } });
    const totals = new Map<string, { pages: number; books: number }>();
    for (const f of finished) {
      const cur = totals.get(f.studentId) ?? { pages: 0, books: 0 };
      cur.pages += f.pages;
      cur.books += 1;
      totals.set(f.studentId, cur);
    }
    const top = [...totals.entries()].sort((a, b) => b[1].pages - a[1].pages).slice(0, 10);
    const students = top.length
      ? await db.student.findMany({ where: { id: { in: top.map(([id]) => id) } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      mine,
      myStudentId,
      isStaff: (STAFF as readonly string[]).includes(me.role),
      leaderboard: top.map(([id, v]) => ({
        studentId: id,
        name: byId.get(id) ? `${byId.get(id)!.user.firstName} ${byId.get(id)!.user.lastName}` : "",
        className: byId.get(id)?.class?.name ?? null,
        pages: v.pages, books: v.books,
      })),
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
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; bookTitle?: string; author?: string; pages?: number; finished?: boolean; rating?: number }>(req);
    const bookTitle = String(body.bookTitle ?? "").trim();
    if (!bookTitle) return apiErr(400, "نام کتاب لازم است.", "BAD_INPUT");
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p) return apiErr(404, "پروندهٔ دانش‌آموزی یافت نشد.", "NOT_FOUND");
      studentId = p.id;
    } else if (!(STAFF as readonly string[]).includes(me.role)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const rating = body.rating ? Math.min(5, Math.max(1, Math.round(Number(body.rating)))) : null;
    const created = await db.readingLog.create({
      data: {
        schoolId, studentId: student.id, bookTitle,
        author: body.author ? String(body.author).trim() : null,
        pages: Math.max(0, Math.round(Number(body.pages ?? 0))),
        finished: body.finished === true,
        rating,
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.readingLog.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (!(STAFF as readonly string[]).includes(me.role)) {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p || p.id !== found.studentId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.readingLog.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
