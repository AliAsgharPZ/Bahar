import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

/** GET /api/tutor-offers?subject= — تابلوی تدریس همتا: چه کسی چه درسی را یاد می‌دهد */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const subject = (req.nextUrl.searchParams.get("subject") ?? "").trim();
    const rows = await db.tutorOffer.findMany({
      where: { schoolId, isActive: true, ...(subject ? { subject: { contains: subject } } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    let myStudentId: string | null = null;
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      myStudentId = p?.id ?? null;
    }
    return apiOk({ myStudentId, items: rows.map((r) => ({ ...r, mine: r.studentId === myStudentId })) });
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
    const body = await readJson<{ subject?: string; level?: string; note?: string }>(req);
    const subject = String(body.subject ?? "").trim();
    if (!subject) return apiErr(400, "نام درس لازم است.", "BAD_INPUT");
    const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true, user: { select: { firstName: true, lastName: true } } } });
    if (!profile) return apiErr(403, "آگهی تدریس با حساب دانش‌آموزی ثبت می‌شود.", "FORBIDDEN");
    const existing = await db.tutorOffer.findFirst({ where: { schoolId, studentId: profile.id, subject, isActive: true } });
    if (existing) return apiErr(409, "برای این درس آگهی فعال دارید.", "DUP");
    const created = await db.tutorOffer.create({
      data: {
        schoolId, studentId: profile.id,
        studentName: `${profile.user.firstName} ${profile.user.lastName}`,
        subject,
        level: body.level ? String(body.level).trim() : null,
        note: body.note ? String(body.note).trim() : null,
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
    const found = await db.tutorOffer.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "آگهی یافت نشد.", "NOT_FOUND");
    const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    if (profile?.id !== found.studentId && !["MANAGER", "SUPER_ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.tutorOffer.update({ where: { id }, data: { isActive: false } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
