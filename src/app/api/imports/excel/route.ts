import { NextRequest, NextResponse } from "next/server";
import { requireUser, apiOk, apiErr, handleApiError, rateLimit, ipOf, audit } from "@/lib/api";
import { excelToCsv, EXCEL_MAX_BYTES } from "@/lib/excel";

/* ============================================================
   بهار | ایمپورت اکسل (راند ۱۸) — تبدیل فایل xlsx/xls به CSV
   خروجی CSV به همان ویزارد ایمپورت موجود (validate/commit) داده
   می‌شود؛ پس منطق اعتبارسنجی و ذخیره یکسان می‌ماند.
   ============================================================ */

const ALLOWED_EXT = /\.(xlsx|xls)$/i;

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (!rateLimit(`excel-parse:${ipOf(req)}`, 20, 60_000)) {
      return apiErr(429, "درخواست‌های زیاد — کمی صبر کنید.", "RATE_LIMITED");
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return apiErr(400, "فایلی ارسال نشده است.", "NO_FILE");
    }
    if (file.size > EXCEL_MAX_BYTES) {
      return apiErr(413, "حجم فایل بیش از ۵ مگابایت است.", "TOO_LARGE");
    }
    if (!ALLOWED_EXT.test(file.name)) {
      return apiErr(400, "فقط فایل‌های اکسل (.xlsx / .xls) پذیرفته می‌شوند؛ برای CSV همان مسیر متنی را استفاده کنید.", "BAD_EXT");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    let parsed: { csv: string; sheetNames: string[]; headers: string[] };
    try {
      parsed = excelToCsv(buf);
    } catch {
      return apiErr(400, "فایل اکسل قابل خواندن نیست — احتمالاً رمزگذاری/فرمت آن معتبر نیست.", "UNPARSEABLE");
    }
    if (!parsed.csv.trim()) {
      return apiErr(400, "شیت اول فایل خالی است.", "EMPTY_SHEET");
    }
    // سقف منطقی — همان محدودیت‌های ویزارد (۲MB متن، ۱۰۰۰ سطر) در مرحله validate اعمال می‌شود
    if (parsed.csv.length > 2_000_000) {
      return apiErr(413, "محتوای فایل بیش از حد بزرگ است (حداکثر ~۲ مگابایت متن).", "TOO_LARGE");
    }

    await audit({
      user: me,
      action: "پارس فایل اکسل ایمپورت",
      entityType: "FILE",
      meta: { name: file.name.slice(0, 80), size: file.size, sheets: parsed.sheetNames.length },
    });

    return apiOk({
      csv: parsed.csv,
      headers: parsed.headers,
      sheetNames: parsed.sheetNames,
      filename: file.name.slice(0, 80),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
