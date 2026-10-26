import * as XLSX from "xlsx";

/* ============================================================
   بهار | ابزار اکسل (راند ۱۸) — ایمپورت/اکسپورت انبوه با فایل xlsx
   سمت سرور — SheetJS. ایمپورت: تبدیل شیت اول به CSV تا همان
   خط‌لولهٔ اعتبارسنجی/ذخیرهٔ موجود تغذیه شود. اکسپورت: ساخت
   ورک‌بوک چندشیتی با سطر عنوان فارسی.
   ============================================================ */

export const EXCEL_MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

/** تبدیل شیت اول فایل اکسل به متن CSV — تغذیه‌کنندهٔ همان parseCsv موجود */
export function excelToCsv(buf: Buffer | ArrayBuffer): {
  csv: string;
  sheetNames: string[];
  headers: string[];
} {
  const wb = XLSX.read(buf, { type: "buffer", codepage: 65001 });
  if (!wb.SheetNames.length) return { csv: "", sheetNames: [], headers: [] };
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  // raw:false → مقدار قالب‌بندی‌شدهٔ سلول (تاریخ‌ها و اعداد مثل چیزی که کاربر دیده)
  const csv = XLSX.utils.sheet_to_csv(ws, { FS: ",", blankrows: false });
  const headers = csv.split("\n")[0]?.split(",").map((h) => h.trim().replace(/^"|"$/g, "")) ?? [];
  return { csv, sheetNames: wb.SheetNames, headers };
}

export type ExcelSheet = { name: string; rows: Array<Array<string | number | null>> };

/** ساخت فایل xlsx از چند شیت — سطر اول هر شیت، سطر عنوان است */
export function buildExcel(sheets: ExcelSheet[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    // عرض ستون خودکار (حداقل ۱۰، حداکثر ۴۰ نویسه)
    const colCount = Math.max(...s.rows.map((r) => r.length), 1);
    ws["!cols"] = Array.from({ length: colCount }, (_, i) => {
      const widest = Math.max(
        10,
        ...s.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2)
      );
      return { wch: Math.min(40, widest) };
    });
    XLSX.utils.book_append_sheet(wb, ws, s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet");
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** نام فایل امن برای هدر Content-Disposition (فارسی/لاتین) */
export function contentDispositionFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
