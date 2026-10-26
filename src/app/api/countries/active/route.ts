import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api";
import { getActiveCountryPublic } from "@/lib/country/server";
import { IRAN_PROFILE } from "@/lib/country/iran";

// ============================================================
// بهار | API بسته کشور فعال — عمومی (بدون راز)
// GET /api/countries/active → پروفایل کامل کشور فعال (دیفالت ایران)
// لوگین/فرم‌های عمومی الگوی کد ملی و موبایل را از اینجا می‌خوانند؛
// انتخابگر نقشه هم مسیر SVG بسته‌های کاستوم را از همین پاس می‌گیرد.
// (نقشه ایران داخلی است و از باندل لود می‌شود — اینجا نمی‌آید)
// ============================================================

export async function GET(_req: NextRequest) {
  try {
    const profile = await getActiveCountryPublic();
    return apiOk({
      profile: {
        ...profile,
        notes: undefined,
      },
      defaultProfile: { code: IRAN_PROFILE.code, name: IRAN_PROFILE.name },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
