import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const OFFICE = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/campaigns — پویش‌های فعال + شمارش پیوستگان + وضعیت پیوستن من */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const rows = await db.campaign.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { signups: { select: { userId: true, name: true } } },
    });
    return apiOk({
      canCreate: (OFFICE as readonly string[]).includes(me.role),
      items: rows.map((c) => ({
        id: c.id, title: c.title, description: c.description, goalText: c.goalText,
        startsAt: c.startsAt, endsAt: c.endsAt, isActive: c.isActive,
        joined: c.signups.some((s) => s.userId === me.id),
        count: c.signups.length,
        recentNames: c.signups.slice(0, 5).map((s) => s.name),
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
    const body = await readJson<{ action?: string; campaignId?: string; title?: string; description?: string; goalText?: string; endsAt?: string; note?: string }>(req);
    if (body.action === "join") {
      const campaign = await db.campaign.findFirst({ where: { id: String(body.campaignId ?? ""), schoolId, isActive: true } });
      if (!campaign) return apiErr(404, "پویش یافت نشد یا تمام شده است.", "NOT_FOUND");
      const existing = await db.campaignSignup.findFirst({ where: { campaignId: campaign.id, userId: me.id } });
      if (existing) return apiErr(409, "قبلاً پیوسته‌اید.", "ALREADY");
      await db.campaignSignup.create({
        data: { campaignId: campaign.id, userId: me.id, name: `${me.firstName} ${me.lastName}`, note: body.note ? String(body.note).trim() : null },
      });
      return apiOk({ ok: true });
    }
    if (!(OFFICE as readonly string[]).includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "عنوان پویش لازم است.", "BAD_INPUT");
    const created = await db.campaign.create({
      data: {
        schoolId, title,
        description: body.description ? String(body.description).trim() : null,
        goalText: body.goalText ? String(body.goalText).trim() : null,
        endsAt: body.endsAt ? String(body.endsAt).trim() : null,
        createdById: me.id,
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
    const body = await readJson<{ id?: string; isActive?: boolean }>(req);
    const found = await db.campaign.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "پویش یافت نشد.", "NOT_FOUND");
    await db.campaign.update({ where: { id: found.id }, data: { isActive: body.isActive !== false } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
