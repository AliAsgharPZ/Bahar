import ExcelJS from "exceljs";

/* ============================================================
   بهار | ابزار اکسل — ایمپورت/اکسپورت انبوه با فایل xlsx
   سمت سرور — ExcelJS (نگهداری‌شده). قبلاً SheetJS (xlsx@0.18.5)
   بود که روی npm دیگر اصلاحیهٔ امنیتی نمی‌گیرد (CVE-2023-30533
   و CVE-2024-22363)؛ برای همین به این کتابخانه کوچ کردیم.
   ایمپورت: تبدیل شیت اول به CSV تا همان خط‌لولهٔ اعتبارسنجی/ذخیرهٔ
   موجود تغذیه شود. اکسپورت: ساخت ورک‌بوک چندشیتی با سطر عنوان فارسی.
   توجه: فرمت قدیمی .xls (باینری) پشتیبانی نمی‌شود — فقط .xlsx.
   ============================================================ */

export const EXCEL_MAX_BYTES = 5 * 1024 * 1024; // ۵ مگابایت

/** متن نمایشی یک سلول — هم‌معنای خروجی قالب‌بندی‌شدهٔ SheetJS */
function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const o = v as { result?: unknown; text?: unknown; richText?: Array<{ text?: unknown }> };
  if (o.result !== undefined) return cellText(o.result);
  if (Array.isArray(o.richText)) return o.richText.map((r) => String(r.text ?? "")).join("");
  if (typeof o.text === "string") return o.text;
  return String(v);
}

function csvEscape(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** تبدیل شیت اول فایل اکسل به متن CSV — تغذیه‌کنندهٔ همان parseCsv موجود */
export async function excelToCsv(buf: Buffer | ArrayBuffer): Promise<{
  csv: string;
  sheetNames: string[];
  headers: string[];
}> {
  const wb = new ExcelJS.Workbook();
  const data = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  await wb.xlsx.load(data as unknown as ExcelJS.Buffer);
  const sheetNames = wb.worksheets.map((w) => w.name);
  const ws = wb.worksheets[0];
  if (!ws) return { csv: "", sheetNames, headers: [] };

  const lines: string[] = [];
  let headers: string[] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = (row.values as unknown[]).slice(1).map((v) => cellText(v));
    if (lines.length === 0) headers = values.map((h) => h.trim());
    lines.push(values.map(csvEscape).join(","));
  });
  return { csv: lines.join("\n"), sheetNames, headers };
}

export type ExcelSheet = { name: string; rows: Array<Array<string | number | null>> };

/** ساخت فایل xlsx از چند شیت — سطر اول هر شیت، سطر عنوان است */
export async function buildExcel(sheets: ExcelSheet[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Sheet");
    for (const r of s.rows) {
      ws.addRow(r.map((c) => c ?? "") as Array<string | number>);
    }
    // عرض ستون خودکار (حداقل ۱۰، حداکثر ۴۰ نویسه)
    const colCount = Math.max(...s.rows.map((r) => r.length), 1);
    for (let i = 0; i < colCount; i++) {
      const widest = Math.max(
        10,
        ...s.rows.slice(0, 200).map((r) => String(r[i] ?? "").length + 2)
      );
      ws.getColumn(i + 1).width = Math.min(40, widest);
    }
  }
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

/** نام فایل امن برای هدر Content-Disposition (فارسی/لاتین) */
export function contentDispositionFilename(name: string): string {
  const ascii = name.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}
