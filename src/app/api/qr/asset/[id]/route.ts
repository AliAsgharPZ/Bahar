import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";
import { qrSvg } from "@/lib/qr";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/qr/asset/[id] — برچسب QR دارایی مدرسه (SVG)
 * اسکن می‌کند → صفحه امکانات همان مدرسه با دارایی هایلایت‌شده باز می‌شود.
 * فقط کارکنان همان مدرسه (یا نقش سرویس داخل پنل) دسترسی دارند.
 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;

    if (!["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(me.role)) {
      return apiErr(403, "دسترسی به برچسب دارایی ندارید.", "FORBIDDEN");
    }

    const asset = await db.asset.findUnique({ where: { id } });
    if (!asset) return apiErr(404, "دارایی یافت نشد.", "NOT_FOUND");

    const scopeSchoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (me.role !== "SUPER_ADMIN" && asset.schoolId !== scopeSchoolId) {
      return apiErr(403, "این دارایی متعلق به مدرسه شما نیست.", "FORBIDDEN");
    }

    const origin = new URL(req.url).origin;
    const svg = qrSvg(`${origin}/app/facilities?tab=assets&asset=${asset.id}`, { ecl: "MEDIUM", scale: 8 });

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
