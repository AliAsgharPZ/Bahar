import path from "path";
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
  "wellbeingCheckin",
  "riskScore",
  "countryPack",
  "languagePack",
  "scheduledReport",
  "gradeHistory",
  "lostFoundItem",
  "visitorLog",
  "loginEvent",
  "savedView",
  "importJob",
  "certificate",
  "certificateTemplate",
  "suggestion",
  "pollVote",
  "pollOption",
  "poll",
  "house",
  "portfolioItem",
  "intervention",
  "studentGoal",
  "studentDocument",
  "customFieldDef",
  "tagDef",
  "maintenanceTicket",
  "asset",
  "booking",
  "room",
  "automationLog",
  "automationRule",
  "task",
  "telegramLink",
  "leaveRequest",
  "changelogEntry",
  "meeting",
  "resourceLink",
  "question",
  "studentBadge",
  "badge",
  "behaviorRecord",
  "notification",
  "backup",
  "studentFee",
  "schoolLead",
  "schoolSite",
  "blogComment",
  "blogPost",
  "ticketMessage",
  "ticket",
  "profileChangeRequest",
  "setting",
  "auditLog",
  "shadOutbox",
  "shadSession",
  "message",
  "announcement",
  "schoolEvent",
  "assignment",
  "gradeRecord",
  "attendance",
  "scheduleSlot",
  "teachingAssignment",
  "subject",
  "studentParent",
  "student",
  "class",
  "school",
  "user",
] as const;

/** ترتیب درج برای بازیابی (پایه‌ها اول) — تولیدشده از schema */
const INSERT_ORDER = [
  "user",
  "school",
  "class",
  "student",
  "studentParent",
  "subject",
  "teachingAssignment",
  "scheduleSlot",
  "attendance",
  "gradeRecord",
  "assignment",
  "schoolEvent",
  "announcement",
  "message",
  "shadSession",
  "shadOutbox",
  "auditLog",
  "setting",
  "profileChangeRequest",
  "ticket",
  "ticketMessage",
  "blogPost",
  "blogComment",
  "schoolSite",
  "schoolLead",
  "studentFee",
  "backup",
  "notification",
  "behaviorRecord",
  "badge",
  "studentBadge",
  "question",
  "resourceLink",
  "meeting",
  "changelogEntry",
  "leaveRequest",
  "telegramLink",
  "task",
  "automationRule",
  "automationLog",
  "room",
  "booking",
  "asset",
  "maintenanceTicket",
  "tagDef",
  "customFieldDef",
  "studentDocument",
  "studentGoal",
  "intervention",
  "portfolioItem",
  "house",
  "poll",
  "pollOption",
  "pollVote",
  "suggestion",
  "certificateTemplate",
  "certificate",
  "importJob",
  "savedView",
  "loginEvent",
  "visitorLog",
  "lostFoundItem",
  "gradeHistory",
  "scheduledReport",
  "languagePack",
  "countryPack",
  "riskScore",
  "wellbeingCheckin",
  "book",
  "bookLoan",
  "quiz",
  "quizAttempt",
  "transportRoute",
  "transportAssignment",
  "staffAttendance",
  "gatePass",
  "schoolForm",
  "formSubmission",
  "alumniProfile",
  "virtualSession",
  "assignmentSubmission",
  "announcementRead",
  "seatingPlan",
  "transportBoarding",
  "reportCommentTemplate",
  "reportComment",
] as const;

/** فیلدهای DateTime هر جدول — فقط همین‌ها در بازیابی به Date تبدیل می‌شوند
 *  (توجه: Attendance.date و ScheduleSlot.date رشته شمسی هستند و نباید تبدیل شوند) */
const DATE_FIELDS: Record<string, readonly string[]> = {
  user: ["birthDate", "createdAt", "hireDate", "lastLoginAt", "lockedUntil", "updatedAt"],
  school: ["createdAt", "planExpiresAt", "updatedAt"],
  class: ["createdAt", "updatedAt"],
  student: ["createdAt", "updatedAt"],
  studentParent: ["createdAt"],
  subject: ["createdAt"],
  teachingAssignment: ["createdAt"],
  scheduleSlot: ["createdAt", "updatedAt"],
  attendance: ["createdAt", "updatedAt"],
  gradeRecord: ["createdAt", "updatedAt"],
  assignment: ["createdAt", "dueDate", "updatedAt"],
  schoolEvent: ["createdAt", "endAt", "startAt"],
  announcement: ["createdAt"],
  message: ["createdAt", "readAt", "sentAt"],
  shadSession: ["authorizedAt", "codeExpiresAt", "codeSentAt", "createdAt", "expiresAt", "updatedAt"],
  shadOutbox: ["createdAt", "sentAt"],
  auditLog: ["createdAt"],
  setting: ["updatedAt"],
  profileChangeRequest: ["createdAt", "reviewedAt"],
  ticket: ["createdAt", "updatedAt"],
  ticketMessage: ["createdAt"],
  blogPost: ["createdAt", "publishedAt", "updatedAt"],
  blogComment: ["createdAt"],
  schoolSite: ["createdAt", "updatedAt"],
  schoolLead: ["createdAt"],
  studentFee: ["createdAt", "dueDate", "lastOverdueNoticeAt", "paidAt", "updatedAt"],
  backup: ["createdAt"],
  notification: ["createdAt", "readAt"],
  behaviorRecord: ["createdAt"],
  badge: ["createdAt"],
  studentBadge: ["awardedAt"],
  question: ["createdAt", "updatedAt"],
  resourceLink: ["createdAt"],
  meeting: ["createdAt", "slotEnd", "slotStart", "updatedAt"],
  changelogEntry: ["publishedAt"],
  leaveRequest: ["createdAt", "fromDate", "toDate", "updatedAt"],
  telegramLink: ["createdAt", "updatedAt"],
  task: ["createdAt", "doneAt", "dueDate", "updatedAt"],
  automationRule: ["createdAt", "lastRunAt", "updatedAt"],
  automationLog: ["createdAt"],
  room: ["createdAt"],
  booking: ["createdAt", "endAt", "startAt"],
  asset: ["createdAt", "purchaseDate", "updatedAt"],
  maintenanceTicket: ["createdAt", "resolvedAt", "updatedAt"],
  tagDef: ["createdAt"],
  customFieldDef: ["createdAt"],
  studentDocument: ["createdAt", "expiresAt", "receivedAt", "updatedAt"],
  studentGoal: ["createdAt", "dueDate", "updatedAt"],
  intervention: ["createdAt", "resolvedAt", "updatedAt"],
  portfolioItem: ["createdAt", "date", "updatedAt"],
  house: ["createdAt"],
  poll: ["closesAt", "createdAt"],
  pollVote: ["createdAt"],
  suggestion: ["createdAt", "updatedAt"],
  certificateTemplate: ["createdAt", "updatedAt"],
  certificate: ["issuedAt", "revokedAt"],
  importJob: ["createdAt"],
  savedView: ["createdAt", "updatedAt"],
  loginEvent: ["createdAt"],
  visitorLog: ["checkInAt", "checkOutAt", "createdAt", "expectedDate", "updatedAt"],
  lostFoundItem: ["claimedAt", "createdAt", "foundAt", "updatedAt"],
  gradeHistory: ["createdAt"],
  scheduledReport: ["createdAt", "lastRunAt", "nextRunAt", "updatedAt"],
  languagePack: ["createdAt", "updatedAt"],
  countryPack: ["createdAt", "updatedAt"],
  riskScore: ["computedAt"],
  wellbeingCheckin: ["createdAt"],
  book: ["createdAt", "updatedAt"],
  bookLoan: ["loanedAt", "dueAt", "returnedAt"],
  quiz: ["createdAt", "updatedAt"],
  quizAttempt: ["startedAt", "submittedAt"],
  transportRoute: ["createdAt", "updatedAt"],
  transportAssignment: ["createdAt"],
  staffAttendance: ["createdAt", "updatedAt"],
  gatePass: ["createdAt", "updatedAt"],
  schoolForm: ["createdAt", "updatedAt"],
  formSubmission: ["createdAt"],
  alumniProfile: ["createdAt", "updatedAt"],
  virtualSession: ["createdAt", "startsAt"],
  assignmentSubmission: ["createdAt", "submittedAt", "updatedAt"],
  announcementRead: ["readAt"],
  seatingPlan: ["createdAt", "updatedAt"],
  transportBoarding: ["createdAt", "boardedAt", "alightedAt"],
  reportCommentTemplate: ["createdAt"],
  reportComment: ["createdAt", "updatedAt"],
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
  const filename = `bahar-backup-${stamp}.json`;
  const content = JSON.stringify(payload, null, 1);
  await storagePut(`backups/${filename}`, content);

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
    await storageDelete(`backups/${old.filename}`);
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
  const content = await storageGetText(`backups/${safe}`);
  if (content === null) throw new Error(`Backup file not found: ${safe}`);
  return content;
}

export async function deleteBackupFile(filename: string): Promise<void> {
  const safe = path.basename(filename);
  await storageDelete(`backups/${safe}`);
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
