import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * GET /api/held-items?status= — کارکنان: دفتر امانات مدرسه؛ دانش‌آموز/ولی: فقط وسایل خودشان
 * POST /api/held-items — ثبت وسیلهٔ گرفته‌شده (کارکنان) + اعلان به اولیا
 * PATCH /api/held-items { id, returnedTo } — ثبت تحویل + اعلان به اولیا
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    let studentFilter: string[] | null = null;
    if (!isStaff) {
      if (me.role === "STUDENT") {
        const profile = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
        studentFilter = profile ? [profile.id] : [];
      } else if (me.role === "PARENT" || me.role === "CUSTODIAN") {
        const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
        studentFilter = links.map((l) => l.studentId);
      } else {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
    }
    const status = req.nextUrl.searchParams.get("status");
    const rows = await db.heldItem.findMany({
      where: {
        schoolId,
        ...(studentFilter ? { studentId: { in: studentFilter } } : {}),
        ...(status === "HELD" || status === "RETURNED" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        student: { select: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } }, studentNumber: true } },
      },
    });
    const classes = isStaff
      ? await db.class.findMany({ where: { schoolId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [];
    return apiOk({
      items: rows.map((r) => ({
        id: r.id, item: r.item, reason: r.reason, status: r.status, createdAt: r.createdAt,
        returnedAt: r.returnedAt, returnedTo: r.returnedTo, note: r.note,
        studentId: r.studentId,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        studentNumber: r.student.studentNumber,
        className: r.student.class?.name ?? null,
      })),
      classes,
      isStaff,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

async function notifyParents(studentId: number | string, title: string, body: string) {
  const links = await db.studentParent.findMany({ where: { studentId: String(studentId) }, select: { parentUserId: true } });
  for (const l of links) {
    await notifyUser(l.parentUserId, "IMPORTANT", title, body, "/app/held-items", "HELD_ITEM");
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; item?: string; reason?: string; note?: string }>(req);
    const item = String(body.item ?? "").trim();
    if (!item) return apiErr(400, "نام وسیله لازم است.", "BAD_INPUT");
    const student = await db.student.findFirst({
      where: { id: String(body.studentId ?? ""), schoolId },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const created = await db.heldItem.create({
      data: {
        schoolId, studentId: student.id, item,
        reason: body.reason ? String(body.reason).trim() : null,
        note: body.note ? String(body.note).trim() : null,
        takenById: me.id,
      },
    });
    await notifyParents(student.id, "وسیله‌ای از فرزند شما نزد مدرسه است", `«${item}» از ${student.user.firstName} ${student.user.lastName} گرفته و در دفتر امانات مدرسه ثبت شد.`);
    await audit({ user: me, action: "HELD_ITEM_TAKE", entityType: "HELD_ITEM", entityId: created.id, schoolId });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; returnedTo?: string }>(req);
    const found = await db.heldItem.findFirst({
      where: { id: String(body.id ?? ""), schoolId },
      include: { student: { select: { user: { select: { firstName: true, lastName: true } } } } },
    });
    if (!found) return apiErr(404, "رکورد یافت نشد.", "NOT_FOUND");
    if (found.status === "RETURNED") return apiErr(409, "این وسیله قبلاً تحویل داده شده است.", "ALREADY_RETURNED");
    const returnedTo = String(body.returnedTo ?? "").trim();
    if (!returnedTo) return apiErr(400, "نام تحویل‌گیرنده لازم است.", "BAD_INPUT");
    const updated = await db.heldItem.update({
      where: { id: found.id },
      data: { status: "RETURNED", returnedAt: new Date(), returnedTo },
    });
    await notifyParents(found.studentId, "وسیلهٔ فرزند شما تحویل داده شد", `«${found.item}» به ${returnedTo} تحویل داده شد.`);
    await audit({ user: me, action: "HELD_ITEM_RETURN", entityType: "HELD_ITEM", entityId: found.id, schoolId });
    return apiOk({ id: updated.id, returnedAt: updated.returnedAt });
  } catch (e) {
    return handleApiError(e);
  }
}
