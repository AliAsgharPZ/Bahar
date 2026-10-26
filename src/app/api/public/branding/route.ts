import { apiOk, handleApiError } from "@/lib/api";
import { getSettings } from "@/lib/settings";

// ============================================================
// بهار | هویت بصری عمومی — بدون احراز هویت (فقط URL‌ها)
// برای لاگین، شل و متادیتا
// ============================================================

export const dynamic = "force-dynamic";

/** GET /api/public/branding — { logoUrl, logotypeUrl, siteTitle } */
export async function GET() {
  try {
    const s = await getSettings();
    return apiOk({
      logoUrl: s.logoUrl || "",
      logotypeUrl: s.logotypeUrl || "",
      siteTitle: s.siteTitle || "بهار",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
