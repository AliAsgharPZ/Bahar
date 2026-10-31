import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
const CATEGORIES = ["NOTE", "INCIDENT", "HANDOVER"] as const;

/**
 * GET /api/duty-logs?date= — دفتر کشیک یک روز (پیش‌فرض: امروز) برای کارکنان مدرسه
 * POST /api/duty-logs — ثبت یادداشت/واقعه/تحویل شیفت
 * DELETE /api/duty-logs?id= — حذف فقط نوشتهٔ خود نویسنده یا مدیر
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const schoolId = requireSchoolId(me);
    const date = req.nextUrl.searchParams.get("date") || todayJalali();
    const rows = await db.dutyLog.findMany({ where: { schoolId, date }, orderBy: { createdAt: "asc" }, take: 200 });
    const authorIds = [...new Set(rows.map((r) => r.authorId))];
    const authors = authorIds.length
      ? await db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, firstName: true, lastName: true, role: true } })
      : [];
    const byId = new Map(authors.map((a) => [a.id, a]));
    return apiOk({
      date,
      items: rows.map((r) => ({
        id: r.id, category: r.category, text: r.text, createdAt: r.createdAt,
        mine: r.authorId === me.id,
        author: byId.get(r.authorId) ?? null,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ text?: string; category?: string; date?: string }>(req);
    const text = String(body.text ?? "").trim();
    if (text.length < 3) return apiErr(400, "متن یادداشت را بنویسید.", "BAD_INPUT");
    const category = (CATEGORIES as readonly string[]).includes(String(body.category)) ? String(body.category) : "NOTE";
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const created = await db.dutyLog.create({
      data: { schoolId, authorId: me.id, date, category, text: text.slice(0, 2000) },
    });
    return apiOk({ id: created.id, date });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.dutyLog.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.authorId !== me.id && me.role !== "MANAGER" && me.role !== "SUPER_ADMIN") {
      return apiErr(403, "فقط نویسنده یا مدیر می‌تواند حذف کند.", "FORBIDDEN");
    }
    await db.dutyLog.delete({ where: { id } });
    await audit({ user: me, action: "DUTY_LOG_DELETE", entityType: "DUTY_LOG", entityId: id, schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
