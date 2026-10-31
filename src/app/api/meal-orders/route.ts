import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const KITCHEN = ["MANAGER", "DEPUTY", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/meal-orders?date= — سفارش‌های من + صف آشپزخانه برای آن روز (با جمع هر غذا) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const date = req.nextUrl.searchParams.get("date") || todayJalali();
    const isKitchen = (KITCHEN as readonly string[]).includes(me.role);
    const rows = await db.mealOrder.findMany({
      where: { schoolId, date, ...(isKitchen ? {} : { requesterId: me.id }) },
      orderBy: { createdAt: "asc" },
      take: 500,
    });
    const summary = new Map<string, number>();
    for (const r of rows) if (r.status !== "CANCELLED") summary.set(r.item, (summary.get(r.item) ?? 0) + 1);
    const ids = [...new Set(rows.map((r) => r.studentId))];
    const students = ids.length
      ? await db.student.findMany({ where: { id: { in: ids } }, select: { id: true, user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } })
      : [];
    const byId = new Map(students.map((s) => [s.id, s]));
    return apiOk({
      isKitchen, date,
      summary: [...summary.entries()].map(([item, count]) => ({ item, count })),
      items: rows.map((r) => ({
        ...r,
        studentName: byId.get(r.studentId) ? `${byId.get(r.studentId)!.user.firstName} ${byId.get(r.studentId)!.user.lastName}` : "",
        className: byId.get(r.studentId)?.class?.name ?? null,
        mine: r.requesterId === me.id,
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
    const body = await readJson<{ studentId?: string; date?: string; item?: string }>(req);
    const item = String(body.item ?? "").trim();
    if (!item) return apiErr(400, "نام غذا لازم است.", "BAD_INPUT");
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") {
      const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
      if (!p) return apiErr(404, "پروندهٔ دانش‌آموزی یافت نشد.", "NOT_FOUND");
      studentId = p.id;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    }
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const dup = await db.mealOrder.findFirst({ where: { schoolId, studentId, date, status: { not: "CANCELLED" } } });
    if (dup) return apiErr(409, "برای این روز قبلاً سفارش ثبت شده است.", "DUP");
    const created = await db.mealOrder.create({ data: { schoolId, studentId, requesterId: me.id, date, item } });
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
    const found = await db.mealOrder.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "سفارش یافت نشد.", "NOT_FOUND");
    const status = String(body.status ?? "");
    if (status === "CANCELLED") {
      if (found.requesterId !== me.id && !(KITCHEN as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.mealOrder.update({ where: { id: found.id }, data: { status: "CANCELLED" } });
      return apiOk({ ok: true });
    }
    if (status === "DELIVERED") {
      if (!(KITCHEN as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.mealOrder.update({ where: { id: found.id }, data: { status: "DELIVERED" } });
      return apiOk({ ok: true });
    }
    return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
  } catch (e) {
    return handleApiError(e);
  }
}
