// Generate src/lib/backup.ts (complete file) from prisma/schema.prisma
// Usage: node scripts/gen-backup-order.mjs > src/lib/backup.ts
import fs from "fs";

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");

// ---- parse models ----
const models = {};
const modelRe = /^model (\w+) \{([\s\S]*?)^\}/gm;
let m;
while ((m = modelRe.exec(schema))) {
  const name = m[1];
  const body = m[2];
  const fkDeps = new Set();
  const relRe = /(\w+)\s+(\w+)\s+@relation\(([^)]*)\)/g;
  let r;
  while ((r = relRe.exec(body))) {
    if (/fields:\s*\[/.test(r[3])) fkDeps.add(r[2]);
  }
  const scalarRe = /^\s+(\w+)\s+(\w+)(\?|\[\])?\s/gm;
  const types = {};
  let s;
  while ((s = scalarRe.exec(body))) types[s[1]] = s[2];
  models[name] = { name, fkDeps, types };
}

const names = Object.keys(models);
if (names.length < 60) throw new Error("schema parse failed — too few models");

// ---- topological sort ----
function topo() {
  const out = [];
  const done = new Set();
  let progress = true;
  while (out.length < names.length && progress) {
    progress = false;
    for (const n of names) {
      if (done.has(n)) continue;
      const deps = [...models[n].fkDeps].filter((d) => d !== n && models[d] && !done.has(d));
      if (deps.length === 0) { out.push(n); done.add(n); progress = true; }
    }
  }
  if (out.length < names.length) {
    throw new Error("circular deps among: " + names.filter((n) => !done.has(n)).join(", "));
  }
  return out;
}
const insertOrder = topo();
const deleteOrder = [...insertOrder].reverse();
const camel = (n) => n[0].toLowerCase() + n.slice(1);

const perModel = {};
for (const n of names) {
  const dks = Object.entries(models[n].types).filter(([, t]) => t === "DateTime").map(([f]) => f).sort();
  if (dks.length) perModel[camel(n)] = dks;
}

const file = `import path from "path";
import { db } from "@/lib/db";
import { storagePut, storageGetText, storageDelete, storageList } from "@/lib/storage";

// ============================================================
// بهار | پشتیبان‌گیری کامل سامانه — خروجی JSON، بازیابی آپلودی
// فایل‌ها در db/backups ذخیره می‌شوند؛ مدل Backup رکورد می‌زند.
//
// ⚠️ این فایل توسط scripts/gen-backup-order.mjs از schema.prisma
// تولید شده است — برای تغییر، ژنراتور را اجرا کنید:
//   node scripts/gen-backup-order.mjs > src/lib/backup.ts
// پوشش کامل همه مدل‌ها + ترتیب وابستگی + فیلدهای DateTime.
// ============================================================

export const BACKUP_VERSION = 3;

/** ترتیب حذف برای بازیابی (وابسته‌ها اول) — تولیدشده از schema */
const DELETE_ORDER = [
${deleteOrder.map((n) => `  "${camel(n)}",`).join("\n")}
] as const;

/** ترتیب درج برای بازیابی (پایه‌ها اول) — تولیدشده از schema */
const INSERT_ORDER = [
${insertOrder.map((n) => `  "${camel(n)}",`).join("\n")}
] as const;

/** فیلدهای DateTime هر جدول — فقط همین‌ها در بازیابی به Date تبدیل می‌شوند
 *  (توجه: Attendance.date و ScheduleSlot.date رشته شمسی هستند و نباید تبدیل شوند) */
const DATE_FIELDS: Record<string, readonly string[]> = {
${Object.entries(perModel).map(([t, f]) => `  ${t}: [${f.map((x) => `"${x}"`).join(", ")}],`).join("\n")}
};

type TableName = (typeof INSERT_ORDER)[number];

async function ensureDir() {
  // Storage backend creates directories/buckets implicitly.
}

/** ساخت نسخه پشتیبان کامل — خروجی: رکورد Backup */
export async function createBackup(opts: {
  kind: "MANUAL" | "AUTO";
  userId?: string | null;
  note?: string;
}): Promise<{ id: string; filename: string; recordCount: number; sizeBytes: number }> {
  await ensureDir();

  const dump: Record<string, unknown[]> = {};
  let recordCount = 0;

  const models = db as unknown as Record<string, { findMany: () => Promise<unknown[]> }>;
  for (const table of INSERT_ORDER) {
    const rows = await models[table].findMany();
    // Backups must never carry live credentials: plaintext temp passwords and
    // second-factor secrets are stripped (passwords can be re-issued after a
    // restore; password hashes are kept so users can still sign in).
    dump[table] = table === "user"
      ? rows.map((r) => {
          const u = r as Record<string, unknown>;
          return { ...u, tempPassword: null, twoFactorSecret: null, backupCodes: null };
        })
      : rows;
    recordCount += rows.length;
  }

  const payload = {
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    kind: opts.kind,
    tables: dump,
  };

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = \`bahar-backup-\${stamp}.json\`;
  const content = JSON.stringify(payload, null, 1);
  await storagePut(\`backups/\${filename}\`, content);

  const sizeBytes = Buffer.byteLength(content, "utf8");
  const record = await db.backup.create({
    data: {
      filename,
      kind: opts.kind,
      sizeBytes,
      recordCount,
      note: opts.note ?? null,
      createdById: opts.userId ?? null,
    },
  });

  // نگه‌داشتن حداکثر ۲۰ نسخه — قدیمی‌ها حذف
  const all = await db.backup.findMany({ orderBy: { createdAt: "desc" } });
  for (const old of all.slice(20)) {
    await storageDelete(\`backups/\${old.filename}\`);
    await db.backup.delete({ where: { id: old.id } });
  }

  return { id: record.id, filename, recordCount, sizeBytes };
}

/** بکاپ خودکار دوره‌ای — اگر آخرین بکاپ خودکار قدیمی‌تر از N روز باشد، یکی می‌سازد */
export async function ensureAutoBackup(days = 30): Promise<boolean> {
  const last = await db.backup.findFirst({
    where: { kind: "AUTO" },
    orderBy: { createdAt: "desc" },
  });
  if (last) {
    const age = Date.now() - last.createdAt.getTime();
    if (age < days * 86400000) return false;
  }
  await createBackup({ kind: "AUTO", note: "پشتیبان‌گیری خودکار دوره‌ای" });
  return true;
}

export async function listBackupFiles(): Promise<string[]> {
  const files = await storageList("backups/");
  return files.filter((f) => f.endsWith(".json"));
}

export async function readBackupFile(filename: string): Promise<string> {
  const safe = path.basename(filename);
  const content = await storageGetText(\`backups/\${safe}\`);
  if (content === null) throw new Error(\`Backup file not found: \${safe}\`);
  return content;
}

export async function deleteBackupFile(filename: string): Promise<void> {
  const safe = path.basename(filename);
  await storageDelete(\`backups/\${safe}\`);
}

export type RestoreResult = {
  restored: Record<string, number>;
  missing: string[]; // جدول‌هایی که در فایل پشتیبان نبودند (پشتیبان قدیمی/ناقص)
  total: number;
};

/** بازیابی کامل — پاک‌سازی و درج مجدد همه رکوردها از فایل بکاپ */
export async function restoreFromPayload(payload: unknown): Promise<RestoreResult> {
  if (!payload || typeof payload !== "object") throw new Error("ساختار فایل بکاپ نامعتبر است.");
  const data = payload as { version?: number; tables?: Record<string, unknown[]> };
  if (!data.tables || data.version !== BACKUP_VERSION) {
    throw new Error("این فایل با نسخه فعلی سامانه سازگار نیست.");
  }

  // اعتبارسنجی اولیه — حداقل کاربر و مدرسه
  const tables = data.tables as Record<TableName, Record<string, unknown>[]>;
  if (!Array.isArray(tables.user) || !Array.isArray(tables.school)) {
    throw new Error("فایل بکاپ ناقص است (کاربر/مدرسه یافت نشد).");
  }

  const restored: Record<string, number> = {};
  const missing: string[] = [];

  await db.$transaction(async (tx) => {
    // حذف همه داده‌های فعلی — کامل و به ترتیب وابستگی
    for (const table of DELETE_ORDER) {
      // @ts-expect-error
      await tx[table].deleteMany();
    }
    // درج داده‌های بکاپ به ترتیب وابستگی
    for (const table of INSERT_ORDER) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        if (!Array.isArray(rows)) missing.push(table);
        continue;
      }
      const dateFields = DATE_FIELDS[table] ?? [];
      const fixed = rows.map((r) => fixDates(r, dateFields));
      // @ts-expect-error
      await tx[table].createMany({ data: fixed, skipDuplicates: true });
      restored[table] = rows.length;
    }
  });

  const total = Object.values(restored).reduce((s, n) => s + n, 0);
  return { restored, missing, total };
}

/** تبدیل رشته‌های ISO به Date — فقط فیلدهای DateTime همان جدول */
function fixDates(row: Record<string, unknown>, dateFields: readonly string[]): Record<string, unknown> {
  if (dateFields.length === 0) return row;
  const out: Record<string, unknown> = { ...row };
  for (const k of dateFields) {
    const v = out[k];
    if (typeof v === "string") out[k] = new Date(v);
  }
  return out;
}
`;

process.stdout.write(file);
console.error(`OK: emitted backup.ts covering ${names.length} models`);
