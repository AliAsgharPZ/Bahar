// بهار | API عمومی بسته زبان فعال — برای انتخاب زبان قبل از ورود
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, handleApiError } from "@/lib/api";
import { shippedLangPack } from "@/lib/langs/shipped";

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get("code") || "").toLowerCase();

    if (!code || code === "fa") {
      return apiOk({ code: "fa", name: "فارسی", nativeName: "فارسی", direction: "rtl", strings: {} });
    }

    const pack = await db.languagePack.findUnique({ where: { code } });
    if (pack && pack.status === "ACTIVE") {
      let strings: Record<string, string> = {};
      try {
        strings = JSON.parse(pack.data) as Record<string, string>;
      } catch {
        strings = {};
      }
      return apiOk({
        code: pack.code,
        name: pack.name,
        nativeName: pack.nativeName,
        direction: pack.direction === "ltr" ? "ltr" : "rtl",
        strings,
      });
    }

    // بازگشت به بستهٔ همراه سامانه — بدون این، انتخاب زبانِ shipped
    // همیشه به فارسی برمی‌گشت (باگ دیده‌شدن، راند ۳).
    const shipped = shippedLangPack(code);
    if (shipped) {
      return apiOk({
        code: shipped.code,
        name: shipped.name,
        nativeName: shipped.nativeName,
        direction: shipped.direction,
        strings: shipped.strings,
      });
    }

    return apiOk({ code: "fa", name: "فارسی", nativeName: "فارسی", direction: "rtl", strings: {} });
  } catch (e) {
    return handleApiError(e);
  }
}
