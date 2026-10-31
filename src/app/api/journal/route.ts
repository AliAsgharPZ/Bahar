import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * GET /api/journal — یادداشت‌های خودم؛ برای همکاران: یادداشت‌هایی که نویسنده با معلم «به اشتراک گذاشته»
 * POST /api/journal — یادداشت تازه (خصوصی است مگر خودم به اشتراک بگذارم)
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const mine = await db.journalEntry.findMany({ where: { schoolId, authorUserId: me.id }, orderBy: { date: "desc" }, take: 100 });
    let shared: { id: string; date: string; mood: string | null; text: string; authorName: string }[] = [];
    if ((STAFF as readonly string[]).includes(me.role)) {
      const rows = await db.journalEntry.findMany({
        where: { schoolId, shared: true, NOT: { authorUserId: me.id } },
        orderBy: { date: "desc" },
        take: 50,
      });
      const authors = rows.length
        ? await db.user.findMany({ where: { id: { in: [...new Set(rows.map((r) => r.authorUserId))] } }, select: { id: true, firstName: true, lastName: true } })
        : [];
      const byId = new Map(authors.map((a) => [a.id, a]));
      shared = rows.map((r) => ({
        id: r.id, date: r.date, mood: r.mood, text: r.text,
        authorName: byId.get(r.authorUserId) ? `${byId.get(r.authorUserId)!.firstName} ${byId.get(r.authorUserId)!.lastName}` : "",
      }));
    }
    return apiOk({ mine, shared, isStaff: (STAFF as readonly string[]).includes(me.role) });
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
    const body = await readJson<{ date?: string; mood?: string; text?: string; shared?: boolean }>(req);
    const text = String(body.text ?? "").trim();
    if (text.length < 3) return apiErr(400, "متن یادداشت لازم است.", "BAD_INPUT");
    const date = body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali();
    const created = await db.journalEntry.create({
      data: {
        schoolId, authorUserId: me.id, date,
        mood: body.mood ? String(body.mood).trim().slice(0, 30) : null,
        text: text.slice(0, 4000),
        shared: body.shared === true,
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
    const found = await db.journalEntry.findFirst({ where: { id, schoolId, authorUserId: me.id } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.journalEntry.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
