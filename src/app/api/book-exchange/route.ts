import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/book-exchange — تابلوی تبادل کتاب: موجودها برای همه + آگهی‌های خودم */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    let myStudentId: string | null = null;
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      myStudentId = p?.id ?? null;
    }
    const rows = await db.bookListing.findMany({
      where: { schoolId, OR: [{ status: "AVAILABLE" }, ...(myStudentId ? [{ ownerStudentId: myStudentId }] : [])] },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return apiOk({
      myStudentId,
      isStaff: (STAFF as readonly string[]).includes(me.role),
      items: rows.map((r) => ({ ...r, mine: r.ownerStudentId === myStudentId })),
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
    const body = await readJson<{ title?: string; grade?: string; price?: number; note?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "نام کتاب لازم است.", "BAD_INPUT");
    const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    if (!profile && !(STAFF as readonly string[]).includes(me.role)) return apiErr(403, "آگهی کتاب با حساب دانش‌آموزی ثبت می‌شود.", "FORBIDDEN");
    const ownerStudentId = profile?.id ?? "STAFF";
    const ownerName = profile ? undefined : `${me.firstName} ${me.lastName}`;
    const student = profile
      ? await db.student.findFirst({ where: { id: profile.id }, select: { user: { select: { firstName: true, lastName: true } } } })
      : null;
    const created = await db.bookListing.create({
      data: {
        schoolId, ownerStudentId,
        ownerName: ownerName ?? (student ? `${student.user.firstName} ${student.user.lastName}` : ""),
        title,
        grade: body.grade ? String(body.grade).trim() : null,
        price: body.price !== undefined && body.price !== null ? Math.max(0, Math.round(Number(body.price))) : null,
        note: body.note ? String(body.note).trim() : null,
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; status?: string }>(req);
    const found = await db.bookListing.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "آگهی یافت نشد.", "NOT_FOUND");
    const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    const isOwner = profile?.id === found.ownerStudentId || found.ownerStudentId === "STAFF" && me.id;
    if (!isOwner && !(STAFF as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const status = body.status === "SOLD" ? "SOLD" : "AVAILABLE";
    await db.bookListing.update({ where: { id: found.id }, data: { status } });
    return apiOk({ ok: true });
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
    const found = await db.bookListing.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "آگهی یافت نشد.", "NOT_FOUND");
    const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    if (profile?.id !== found.ownerStudentId && !(STAFF as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.bookListing.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
