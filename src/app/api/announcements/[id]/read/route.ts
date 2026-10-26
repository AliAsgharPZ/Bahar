import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError } from "@/lib/api";

/* ============================================================
   بهار | رسید خواندن اطلاعیه — هر کاربر با بازکردن اطلاعیه
   خواندنش ثبت می‌شود؛ مدیر فهرست خوانندگان را می‌بیند.
   ============================================================ */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const ann = await db.announcement.findUnique({ where: { id }, select: { id: true } });
    if (!ann) return apiErr(404, "اطلاعیه یافت نشد.", "NOT_FOUND");
    await db.announcementRead.upsert({
      where: { announcementId_userId: { announcementId: id, userId: me.id } },
      create: { announcementId: id, userId: me.id },
      update: {},
    });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const { id } = await ctx.params;
    const ann = await db.announcement.findUnique({ where: { id }, select: { id: true, schoolId: true } });
    if (!ann) return apiErr(404, "اطلاعیه یافت نشد.", "NOT_FOUND");
    if (me.schoolId && ann.schoolId && me.schoolId !== ann.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const reads = await db.announcementRead.findMany({
      where: { announcementId: id },
      include: { user: { select: { firstName: true, lastName: true, role: true } } },
      orderBy: { readAt: "asc" },
    });
    return apiOk({
      count: reads.length,
      readers: reads.map((r) => ({
        name: `${r.user.firstName} ${r.user.lastName}`,
        role: r.user.role,
        readAt: r.readAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
