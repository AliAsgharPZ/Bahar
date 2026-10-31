import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;
const KINDS = ["آتش‌نشانی", "زلزله", "تخلیه اضطراری", "کمک‌های اولیه", "دیگر"] as const;

/** GET /api/drill-log — مانورهای ایمنی برگزارشده + شمارش سالانهٔ هر نوع */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const items = await db.drillLog.findMany({ where: { schoolId }, orderBy: { date: "desc" }, take: 100 });
    const counts = new Map<string, number>();
    for (const d of items) counts.set(d.kind, (counts.get(d.kind) ?? 0) + 1);
    return apiOk({ isStaff: (STAFF as readonly string[]).includes(me.role), items, counts: [...counts.entries()].map(([kind, count]) => ({ kind, count })) });
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
    const body = await readJson<{ kind?: string; date?: string; durationMin?: number; notes?: string }>(req);
    const kind = body.kind && (KINDS as readonly string[]).includes(body.kind) ? body.kind : "دیگر";
    const created = await db.drillLog.create({
      data: {
        schoolId, kind,
        date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali(),
        durationMin: body.durationMin ? Math.max(1, Math.round(Number(body.durationMin))) : null,
        notes: body.notes ? String(body.notes).trim() : null,
        createdById: me.id,
      },
    });
    return apiOk({ id: created.id });
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
    const found = await db.drillLog.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.drillLog.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
