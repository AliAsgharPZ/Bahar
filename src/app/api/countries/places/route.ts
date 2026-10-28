import { NextRequest } from "next/server";
import { apiOk, apiErr, handleApiError } from "@/lib/api";
import { placesFor, SHIPPED_CODES } from "@/lib/country/shipped";

/* بهار | مکان‌های کشور — استان → شهر → روستا، از بسته‌های همراه سامانه.
   بدون نیاز به نشست (فهرست مکان‌ها دادهٔ عمومی است)؛ اگر کد کشور
   همراه سامانه نباشد، فهرست کدهای موجود برگردانده می‌شود. */

export async function GET(req: NextRequest) {
  try {
    const q = new URL(req.url).searchParams;
    const code = (q.get("code") ?? "IR").toUpperCase();
    const result = placesFor(code, q.get("province") ?? undefined, q.get("city") ?? undefined);
    if (!result) return apiErr(404, `بستهٔ کشور ${code} همراه سامانه نیست.`, "NOT_SHIPPED", { shipped: SHIPPED_CODES });
    return apiOk({ code, ...result });
  } catch (e) {
    return handleApiError(e);
  }
}
