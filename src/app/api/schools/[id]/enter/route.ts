import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, readJson, audit, ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/schools/[id]/enter — ورود ادمین سرویس به پنل مدرسه
 * کوکی bahar_acting_school ست می‌شود و ادمین مثل مدیر در آن مدرسه عمل می‌کند.
 * POST با {exit: true} برای خروج از پنل.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const body = await readJson<{ exit?: boolean }>(req).catch(() => ({}) as { exit?: boolean });

    if (me.role !== "SUPER_ADMIN" && !(me.role === "ADMIN" && hasPermission(me, "enter_school_panel"))) {
      throw new ApiError(403, "FORBIDDEN", "دسترسی «ورود به پنل مدرسه» برای شما فعال نیست.");
    }

    if (body.exit === true) {
      const res = apiOk({ ok: true, exited: true });
      res.cookies.set("bahar_acting_school", "", { path: "/", maxAge: 0 });
      return res;
    }

    const school = await db.school.findUnique({ where: { id }, select: { id: true, name: true, isActive: true } });
    if (!school) throw new ApiError(404, "NOT_FOUND", "مدرسه یافت نشد.");
    if (!school.isActive) throw new ApiError(400, "INACTIVE", "این مدرسه غیرفعال است.");

    await audit({
      user: me, action: "ENTER_SCHOOL_PANEL", entityType: "SCHOOL", entityId: id,
      schoolId: id, meta: { name: school.name },
    });

    const res = NextResponse.json({ ok: true, school: { id: school.id, name: school.name } });
    res.cookies.set("bahar_acting_school", id, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 3600, // حداکثر ۸ ساعت
    });
    return res;
  } catch (e) {
    return handleApiError(e);
  }
}
