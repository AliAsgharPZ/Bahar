import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/volunteer — ساعت‌های داوطلبانهٔ من + (برای دفتر) صف تأیید و جمع ساعت‌های تأییدشدهٔ هر نفر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const mine = await db.volunteerEntry.findMany({ where: { schoolId, userId: me.id }, orderBy: { createdAt: "desc" }, take: 100 });
    const pending = isOffice
      ? await db.volunteerEntry.findMany({ where: { schoolId, approved: false }, orderBy: { createdAt: "asc" }, take: 100 })
      : [];
    const approvedRows = await db.volunteerEntry.findMany({ where: { schoolId, approved: true }, select: { userId: true, name: true, hours: true } });
    const totals = new Map<string, { name: string; hours: number }>();
    for (const r of approvedRows) {
      const cur = totals.get(r.userId) ?? { name: r.name, hours: 0 };
      cur.hours += r.hours;
      totals.set(r.userId, cur);
    }
    return apiOk({
      isOffice, mine, pending,
      myApprovedHours: (totals.get(me.id)?.hours ?? 0),
      leaderboard: [...totals.entries()].map(([userId, v]) => ({ userId, ...v })).sort((a, b) => b.hours - a.hours).slice(0, 10),
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
    const body = await readJson<{ activity?: string; hours?: number; date?: string }>(req);
    const activity = String(body.activity ?? "").trim();
    if (!activity) return apiErr(400, "شرح فعالیت لازم است.", "BAD_INPUT");
    const hours = Math.min(24, Math.max(0.5, Number(body.hours ?? 1) || 1));
    const created = await db.volunteerEntry.create({
      data: {
        schoolId, userId: me.id, name: `${me.firstName} ${me.lastName}`,
        activity, hours,
        date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali(),
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...OFFICE]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string }>(req);
    const found = await db.volunteerEntry.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.volunteerEntry.update({ where: { id: found.id }, data: { approved: true } });
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
    const found = await db.volunteerEntry.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (found.userId !== me.id && !(OFFICE as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.volunteerEntry.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
