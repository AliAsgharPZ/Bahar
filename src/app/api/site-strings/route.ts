import { NextRequest } from "next/server";
import { apiOk, handleApiError } from "@/lib/api";
import { siteStringsFor, SITE_LANGS } from "@/lib/langs/shipped";

/* بهار | API عمومی جملات سایت — لندینگ و صفحات عمومی بر اساس زبان
   انتخاب‌شدهٔ بازدیدکننده (کوکی bahar_site_lang) جمله می‌گیرند؛
   کلید ترجمه‌نشده به فارسی پایه بازمی‌گردد. فقط خواندنی است. */

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("lang") || "fa").toLowerCase();
    const resolved = siteStringsFor(code);
    return apiOk({
      code: resolved.code,
      direction: resolved.direction,
      siteStrings: resolved.siteStrings,
      langs: SITE_LANGS,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
