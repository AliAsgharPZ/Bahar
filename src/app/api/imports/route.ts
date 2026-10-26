import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { hashPassword, generatePassword, isValidNationalId } from "@/lib/auth";
import { enDigits } from "@/lib/persian";

/* ============================================================
   بهار | Import Wizard — CSV دانش‌آموزان با Mapping و Validation
   مرحله ۱: parse → پیش‌نمایش + خطاها (بدون ذخیره)
   مرحله ۲: commit → ذخیره واقعی + تاریخچه
   ============================================================ */

type Row = Record<string, string>;

function parseCsv(text: string): { headers: string[]; rows: Row[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
  if (!clean) return { headers: [], rows: [] };
  const lines: string[][] = [];
  let cur: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === "," || ch === ";" || ch === "\t") { cur.push(cell); cell = ""; }
    else if (ch === "\n") { cur.push(cell); lines.push(cur); cur = []; cell = ""; }
    else cell += ch;
  }
  cur.push(cell);
  lines.push(cur);
  const headers = (lines.shift() ?? []).map((h) => h.trim());
  const rows = lines.filter((l) => l.some((c) => c.trim())).map((l) => {
    const row: Row = {};
    headers.forEach((h, i) => { row[h] = enDigits((l[i] ?? "").trim()); });
    return row;
  });
  return { headers, rows };
}

type Validation = { row: number; errors: string[]; warnings: string[]; data: Row };

/* راند ۱۸ — تشخیص خودکار ستون‌های فارسی وقتی mapping صریح نیامده است.
   قبلاً ویزارد بدون mapping با سربرگ فارسی همهٔ سطرها را نامعتبر می‌داد! */
const HEADER_RULES: Array<[string, RegExp]> = [
  ["lastName", /نام\s*خانوادگی|فامیلی|last/i],
  ["firstName", /^نام$|اسم|first/i],
  ["nationalId", /کد\s*ملی|کدملی|national|melli/i],
  ["studentNumber", /شماره\s*دانش|دانش\s*آموزی|student\s*num/i],
  ["fatherName", /نام\s*پدر|father/i],
  ["gender", /جنسیت|gender/i],
  ["birthDate", /تولد|birth/i],
  ["phone", /موبایل|تلفن|همراه|phone|mobile/i],
  ["address", /آدرس|نشانی|address/i],
  ["previousSchool", /مدرسه\s*قبلی|previous/i],
];

const STAFF_HEADER_RULES: Array<[string, RegExp]> = [
  ["role", /نقش|سمت|role/i],
  ["email", /ایمیل|رایانامه|email/i],
];

/** نقش‌های قابل ایمپورت برای کارکنان — ادمین سامانه از این مسیر ساخته نمی‌شود */
const STAFF_ROLES: Record<string, string> = {
  MANAGER: "MANAGER", مدیر: "MANAGER",
  DEPUTY: "DEPUTY", معاون: "DEPUTY",
  TEACHER: "TEACHER", معلم: "TEACHER", دبیر: "TEACHER",
  CUSTODIAN: "CUSTODIAN", سرایدار: "CUSTODIAN", خدمتگزار: "CUSTODIAN",
};

function autoMap(headers: string[], explicit: Record<string, string> | undefined, staff = false): Record<string, string> {
  const m: Record<string, string> = {};
  const rules = staff ? [...HEADER_RULES, ...STAFF_HEADER_RULES] : HEADER_RULES;
  for (const [field, re] of rules) {
    const hit = headers.find((h) => re.test(h.trim()));
    if (hit) m[field] = hit.trim();
  }
  return { ...m, ...(explicit ?? {}) };
}

function validateStaff(rows: Row[], mapping: Record<string, string>): Validation[] {
  return rows.map((row, idx) => {
    const get = (field: string) => row[mapping[field] ?? field] ?? "";
    const errors: string[] = [];
    const warnings: string[] = [];
    if (!get("firstName")) errors.push("نام خالی است");
    if (!get("lastName")) errors.push("نام خانوادگی خالی است");
    const nationalId = get("nationalId");
    if (!nationalId) errors.push("کد ملی خالی است");
    else if (!/^\d{10}$/.test(nationalId)) errors.push("کد ملی ۱۰ رقم نیست");
    else if (!isValidNationalId(nationalId)) errors.push("کد ملی نامعتبر (رقم کنترل)");
    const roleRaw = get("role").trim();
    if (!roleRaw) errors.push("نقش خالی است (مدیر/معاون/معلم/سرایدار)");
    else if (!STAFF_ROLES[roleRaw] && !STAFF_ROLES[roleRaw.toUpperCase()]) errors.push(`نقش نامعتبر: ${roleRaw}`);
    const phone = get("phone");
    if (phone && !/^09\d{9}$/.test(phone)) warnings.push("شماره موبایل نامعتبر");
    const email = get("email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) warnings.push("ایمیل نامعتبر");
    return { row: idx + 1, errors, warnings, data: row };
  });
}

function validateStudents(rows: Row[], mapping: Record<string, string>): Validation[] {
  return rows.map((row, idx) => {
    const get = (field: string) => row[mapping[field] ?? field] ?? "";
    const errors: string[] = [];
    const warnings: string[] = [];
    const firstName = get("firstName");
    const lastName = get("lastName");
    const nationalId = get("nationalId");
    const studentNumber = get("studentNumber");
    if (!firstName) errors.push("نام خالی است");
    if (!lastName) errors.push("نام خانوادگی خالی است");
    if (!nationalId) errors.push("کد ملی خالی است");
    else if (!/^\d{10}$/.test(nationalId)) errors.push("کد ملی ۱۰ رقم نیست");
    else if (!isValidNationalId(nationalId)) errors.push("کد ملی نامعتبر (رقم کنترل)");
    if (!studentNumber) warnings.push("شماره دانش‌آموزی خالی — تولید خودکار");
    const phone = get("phone");
    if (phone && !/^09\d{9}$/.test(phone)) warnings.push("شماره موبایل نامعتبر");
    const fatherName = get("fatherName");
    if (!fatherName) warnings.push("نام پدر خالی");
    return { row: idx + 1, errors, warnings, data: row };
  });
}

/** POST /api/imports — parse/validate یا commit */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]); // FIX راند ۱۶: معاون هم گزارش/ایمپورت
    const body = await readJson<{
      action: "validate" | "commit";
      csv?: string;
      mapping?: Record<string, string>;
      classId?: string;
      entryYear?: string;
      importId?: string;
      kind?: string;
    }>(req);
    const isStaff = body.kind === "staff";

    if (body.action === "validate") {
      // FIX (راند ۱۸): acting-school — سوپرادمین/ادمین داخل پنل مدرسه هم ایمپورت می‌کنند
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
      if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست؛ سوپرادمین باید وارد پنل یک مدرسه شود.", "NO_SCHOOL");
      if (!body.csv?.trim()) return apiErr(400, "محتوای CSV خالی است.", "EMPTY");
      if (body.csv.length > 2_000_000) return apiErr(413, "فایل بیش از حد بزرگ است (حداکثر ~۲ مگابایت).", "TOO_LARGE");
      const { headers, rows } = parseCsv(body.csv);
      if (!headers.length || !rows.length) return apiErr(400, "CSV قابل خواندن نیست؛ سطر عنوان یا داده یافت نشد.", "UNPARSEABLE");
      if (rows.length > 1000) return apiErr(413, "حداکثر ۱۰۰۰ سطر در هر ایمپورت.", "TOO_MANY_ROWS");
      // راند ۱۸: mapping خودکار سربرگ فارسی + mapping صریح کلاینت
      const mapping = autoMap(headers, body.mapping, isStaff);
      const validations = isStaff ? validateStaff(rows, mapping) : validateStudents(rows, mapping);
      const nidKey = mapping.nationalId ?? "nationalId";
      // تشخیص duplicate داخلی
      const seen = new Map<string, number>();
      for (const v of validations) {
        const nid = v.data[nidKey] ?? v.data.nationalId ?? "";
        if (nid && seen.has(nid)) v.errors.push(`کد ملی تکراری با سطر ${seen.get(nid)}`);
        else if (nid) seen.set(nid, v.row);
      }
      // duplicate با دیتابیس
      const nids = [...new Set(validations.map((v) => v.data[nidKey] ?? "").filter(Boolean))];
      if (nids.length) {
        const existing = await db.user.findMany({ where: { nationalId: { in: nids } }, select: { nationalId: true } });
        const existingSet = new Set(existing.map((e) => e.nationalId));
        for (const v of validations) {
          const nid = v.data[nidKey] ?? "";
          if (existingSet.has(nid)) v.errors.push("کاربری با این کد ملی از قبل وجود دارد");
        }
      }
      const errorCount = validations.filter((v) => v.errors.length).length;
      // ایجاد job موقت — jobهای RUNNINGِ رهاشدهٔ قبلی همین کاربر باطل می‌شوند
      await db.importJob.updateMany({
        where: { userId: me.id, status: "RUNNING" },
        data: { status: "CANCELLED" },
      });
      const job = await db.importJob.create({
        data: {
          schoolId, userId: me.id, kind: isStaff ? "STAFF" : "STUDENTS",
          filename: "paste.csv", totalRows: rows.length,
          status: "RUNNING",
        },
      });
      return apiOk({
        jobId: job.id,
        headers,
        total: rows.length,
        valid: rows.length - errorCount,
        invalid: errorCount,
        preview: validations.slice(0, 50),
      });
    }

    if (body.action === "commit") {
      const blocked = await demoWriteBlock(me);
      if (blocked) return blocked;
      // FIX (راند ۱۸): acting-school — هم‌تراز با validate
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
      if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست؛ سوپرادمین باید وارد پنل یک مدرسه شود.", "NO_SCHOOL");
      // job باید موجود، هم‌مدرسه و در وضعیت RUNNING باشد
      const targetJob = body.importId
        ? await db.importJob.findFirst({ where: { id: String(body.importId), schoolId } })
        : null;
      if (!targetJob) return apiErr(404, "عملیات ایمپورت یافت نشد.", "NOT_FOUND");
      if (targetJob.status !== "RUNNING") return apiErr(409, "این عملیات ایمپورت قبلاً تکمیل یا لغو شده است.", "NOT_RUNNING");
      const staffJob = targetJob.kind === "STAFF";
      if (!body.importId || !body.csv || (!staffJob && !body.classId)) return apiErr(400, "اطلاعات ایمپورت ناقص است.", "BAD_REQUEST");
      if (!staffJob) {
        const cls = await db.class.findFirst({ where: { id: body.classId, schoolId } });
        if (!cls) return apiErr(404, "کلاس هدف یافت نشد.", "NO_CLASS");
      }
      // ⚠ همان سقف‌های مرحلهٔ validate — قبلاً commit بدون سقف پردازش می‌کرد (DoS)
      if (String(body.csv).length > 2_000_000) return apiErr(413, "فایل CSV بزرگ‌تر از حد مجاز (۲ مگابایت) است.", "TOO_LARGE");
      const { headers: commitHeaders, rows } = parseCsv(body.csv);
      if (rows.length > 1000) return apiErr(413, "حداکثر ۱۰۰۰ ردیف در هر ایمپورت.", "TOO_MANY_ROWS");
      // راند ۱۸: mapping خودکار (هم‌تراز validate) + mapping صریح
      const m = autoMap(commitHeaders, body.mapping, staffJob);
      const validations = staffJob ? validateStaff(rows, m) : validateStudents(rows, m);
      const get = (row: Row, field: string) => row[m[field] ?? field] ?? "";

      const errors: Array<{ row: number; error: string }> = [];
      let success = 0;

      if (staffJob) {
        for (const v of validations) {
          if (v.errors.length) { errors.push({ row: v.row, error: v.errors.join("؛ ") }); continue; }
          const row = v.data;
          const roleRaw = get(row, "role").trim();
          const role = STAFF_ROLES[roleRaw] ?? STAFF_ROLES[roleRaw.toUpperCase()];
          const tempPassword = generatePassword();
          try {
            await db.user.create({
              data: {
                nationalId: get(row, "nationalId"),
                passwordHash: hashPassword(tempPassword),
                tempPassword,
                role,
                firstName: get(row, "firstName"),
                lastName: get(row, "lastName"),
                phone: get(row, "phone") || null,
                email: get(row, "email") || null,
                schoolId,
              },
            });
            success++;
          } catch (e) {
            errors.push({ row: v.row, error: e instanceof Error ? e.message.slice(0, 120) : "خطا" });
          }
        }
        await db.importJob.update({
          where: { id: body.importId },
          data: { successRows: success, failedRows: errors.length, errors: JSON.stringify(errors.slice(0, 100)), status: "DONE" },
        });
        await audit({ user: me, action: "ایمپورت کارکنان", entityType: "ImportJob", entityId: body.importId, schoolId, meta: { success, failed: errors.length } });
        return apiOk({ success, failed: errors.length, errors: errors.slice(0, 50) });
      }

      for (const v of validations) {
        if (v.errors.length) { errors.push({ row: v.row, error: v.errors.join("؛ ") }); continue; }
        const row = v.data;
        const nationalId = get(row, "nationalId");
        const tempPassword = generatePassword();
        try {
          await db.$transaction(async (tx) => {
            const user = await tx.user.create({
              data: {
                nationalId,
                passwordHash: hashPassword(tempPassword),
                tempPassword,
                role: "STUDENT",
                firstName: get(row, "firstName"),
                lastName: get(row, "lastName"),
                fatherName: get(row, "fatherName") || null,
                gender: ["MALE", "FEMALE", "مرد", "زن"].includes(get(row, "gender")) ? (get(row, "gender") === "زن" ? "FEMALE" : get(row, "gender") === "مرد" ? "MALE" : get(row, "gender")) : null,
                birthDate: get(row, "birthDate") ? new Date(get(row, "birthDate")) : null,
                phone: get(row, "phone") || null,
                address: get(row, "address") || null,
                schoolId,
              },
            });
            await tx.student.create({
              data: {
                userId: user.id,
                schoolId,
                classId: body.classId!,
                studentNumber: get(row, "studentNumber") || `${Date.now().toString().slice(-6)}${v.row}`,
                entryYear: body.entryYear ?? null,
                previousSchool: get(row, "previousSchool") || null,
              },
            });
          });
          success++;
        } catch (e) {
          errors.push({ row: v.row, error: e instanceof Error ? e.message.slice(0, 120) : "خطا" });
        }
      }
      await db.importJob.update({
        where: { id: body.importId },
        data: { successRows: success, failedRows: errors.length, errors: JSON.stringify(errors.slice(0, 100)), status: "DONE" },
      });
      await audit({ user: me, action: "ایمپورت دانش‌آموزان", entityType: "ImportJob", entityId: body.importId, schoolId, meta: { success, failed: errors.length } });
      return apiOk({ success, failed: errors.length, errors: errors.slice(0, 50) });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/imports — تاریخچه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]); // FIX راند ۱۶: معاون هم گزارش/ایمپورت
    // FIX (راند ۱۸): acting-school — هم‌تراز با validate/commit
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiOk({ jobs: [] });
    const jobs = await db.importJob.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    return apiOk({ jobs });
  } catch (e) {
    return handleApiError(e);
  }
}
