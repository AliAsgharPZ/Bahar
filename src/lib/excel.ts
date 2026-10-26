import * as XLSX from "xlsx";

/* ============================================================
   بهار | ابزار اکسل — ایمپورت/اکسپورت انبوه با فایل xlsx
   سمت سرور — SheetJS (xlsx) نسخهٔ 0.20.3 از CDN رسمی SheetJS:
   نسخهٔ npm (0.18.5) آسیب‌پذیری‌های CVE-2023-30533 و
   CVE-2024-22363 دارد و SheetJS اصلاحیه را فقط از CDN خودش
   منتشر می‌کند؛ نسخهٔ 0.20.3 هر دو اصلاحیه را دارد.
   (دوره‌ای ExcelJS استفاده شد ولی درخت وابستگی سنگینش —
   ۲۳ مگابایت — مرحلهٔ بسته‌بندی OpenNext روی Workers Builds
   را دو بار پیاپی به تایم‌اوت رساند؛ SheetJS تک‌بسته و سبک
   است و بیلد موفق استقرار اول هم با همین کتابخانه بود.)
   ایمپورت: تبدیل شیت اول به CSV تا همان خط‌لولهٔ اعتبارسنجی/
   ذخیرهٔ موجود تغذیه شود. اکسپورت: ساخت ورک‌بوک چندشیتی با
   سطر عنوان فارسی. فرمت قدیمی .xls پشتیبانی نمی‌شود.
   ============================================================ */

export const EXCEL_MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

/** تبدیل شیت اول فایل اکسل به متن CSV — تغذیه‌کنندهٔ همان parseCsv موجود */
export async function excelToCsv(buf: Buffer | ArrayBuffer): Promise<{
  csv: string;
  sheetNames: string[];
  headers: string[];
}> {
  const data = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer, buf instanceof ArrayBuffer ? 0 : buf.byteOffset, buf instanceof ArrayBuffer ? undefined : buf.byteLength);
  const wb = XLSX.read(data, { type: "array", cellDates: true });
  const sheetNames = wb.SheetNames;
  const ws = wb.Sheets[sheetNames[0]];
  if (!ws) return { csv: "", sheetNames, headers: [] };
  // خروجی پیش‌فرض sheet_to_csv متن قالب‌بندی‌شدهٔ سلول است (مثل نمایش اکسل)
  const csv = XLSX.utils.sheet_to_csv(ws);
  const firstLine = csv.split("\n")[0] ?? "";
  const headers = firstLine
    .split(",")
    .map((h) => h.replace(/^"|"$/g, "").trim());
  return { csv, sheetNames, headers };
}

export type ExcelSheet = { name: string; rows: Array<Array<string | number | null>> };

/** ساخت فایل xlsx از چند شیت — سطر اول هر شیت، سطر عنوان است */
export async function buildExcel(sheets: ExcelSheet[]): Promise<Buffer> {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const rows = s.rows.map((r) => r.map((c) => c ?? ""));
    const ws = XLSX.utils.aoa_to_sheet(rows);
    // عرض ستون خودکار (حداقل ۱۰، حداکثر ۴۰ نویسه)
    const colCount = Math.max(...rows.map((r) => r.length), 1);
    ws["!cols"] = Array.from({ length: colCount }, (_, i) => ({
      wch: Math.min(
        40,
        Math.max(10, ...rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2))
      ),
    }));
    const safeName = s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
  return Buffer.from(out);
}

/** نام فایل امن برای هدر Content-Disposition (فارسی/لاتین) */
export function contentDispositionFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
