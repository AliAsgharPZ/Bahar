import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiErr, handleApiError, actingSchoolIdFor, rateLimit, ipOf, audit } from "@/lib/api";
import { buildExcel, contentDispositionFilename, type ExcelSheet } from "@/lib/excel";
import { ROLE_LABELS } from "@/lib/roles";
import { convertScore } from "@/lib/grades-scale";
import { STUDENT_STATUS_LABELS, PARENT_RELATION_LABELS, ATTENDANCE_LABELS } from "@/lib/persian";

/* ============================================================
   بهار | اکسپورت انبوه (راند ۱۸) — GET /api/export?type=...&format=xlsx|csv
   دانش‌آموزان / کاربران / کلاس‌ها / نمرات / حضور و غیاب / امور مالی
   به‌صورت فایل اکسل واقعی یا CSV.
   دامنه: مدیر/معاون → مدرسه خودشان؛ سوپرادمین/ادمین → پنل فعال
   یا (بدون پنل) کل سامانه.
   ============================================================ */

const TYPES = ["students", "users", "classes", "grades", "attendance", "fees"] as const;

const GRADE_KIND_LABELS: Record<string, string> = {
  QUIZ: "آزمونک",
  MIDTERM: "میان‌نوبت",
  FINAL: "پایان‌نوبت",
  PROJECT: "پروژه",
  ACTIVITY: "فعالیت کلاسی",
  BEHAVIOR: "رفتار",
};

const FEE_STATUS_LABELS: Record<string, string> = {
  UNPAID: "پرداخت‌نشده",
  PAID: "پرداخت‌شده",
  WAIVED: "بخشوده‌شده",
};

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

/** سریال‌سازی CSV — BOM برای نمایش درست فارسی در اکسل + خنثی‌سازی فرمول */
function toCsv(rows: unknown[][]): string {
  const cell = (v: unknown): string => {
    let s = v == null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (!rateLimit(`export:${ipOf(req)}`, 10, 60_000)) {
      return apiErr(429, "درخواست‌های زیاد — کمی صبر کنید.", "RATE_LIMITED");
    }
    const url = new URL(req.url);
    const type = url.searchParams.get("type") ?? "students";
    if (!TYPES.includes(type as (typeof TYPES)[number])) {
      return apiErr(400, "نوع خروجی نامعتبر است.", "BAD_TYPE");
    }
    const format = url.searchParams.get("format") === "csv" ? "csv" : "xlsx";

    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    // مدیر/معاون: مدرسه خودشان. سوپرادمین/ادمین: پنل فعال یا کل سامانه.
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId && !isService) {
      return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    }
    const school = schoolId ? await db.school.findUnique({ where: { id: schoolId }, select: { name: true } }) : null;
    const global = !schoolId; // سوپرادمین بدون پنل مدرسه → کل سامانه

    let sheets: ExcelSheet[] = [];
    let filename = "bahar-export";

    if (type === "students") {
      if (global) {
        return apiErr(400, "برای خروجی دانش‌آموزان ابتدا وارد پنل یک مدرسه شوید (صفحه «مدارس»).", "NO_SCHOOL");
      }
      const students = await db.student.findMany({
        where: { schoolId: schoolId! },
        include: {
          user: { select: { firstName: true, lastName: true, nationalId: true, fatherName: true, gender: true, birthDate: true, phone: true, address: true } },
          class: { select: { name: true, grade: true } },
          parents: { include: { parentUser: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: "desc" },
      });
      sheets = [{
        name: "دانش‌آموزان",
        rows: [
          ["شماره دانش‌آموزی", "نام", "نام خانوادگی", "کد ملی", "نام پدر", "جنسیت", "تاریخ تولد", "موبایل", "کلاس", "پایه", "وضعیت", "سال ورود", "مدرسه قبلی", "آدرس", "اولیا"],
          ...students.map((s) => [
            s.studentNumber,
            s.user.firstName,
            s.user.lastName,
            s.user.nationalId,
            s.user.fatherName ?? "",
            s.user.gender === "MALE" ? "پسر" : s.user.gender === "FEMALE" ? "دختر" : "",
            s.user.birthDate ? s.user.birthDate.toISOString().slice(0, 10) : "",
            s.user.phone ?? "",
            s.class?.name ?? "بدون کلاس",
            s.class?.grade ?? "",
            STUDENT_STATUS_LABELS[s.status] ?? s.status,
            s.entryYear ?? "",
            s.previousSchool ?? "",
            s.user.address ?? "",
            s.parents.map((p) => `${PARENT_RELATION_LABELS[p.relation] ?? p.relation}: ${p.parentUser.firstName} ${p.parentUser.lastName}`).join(" | "),
          ]),
        ],
      }];
      filename = `bahar-students-${todayStamp()}`;
    } else if (type === "users") {
      const users = await db.user.findMany({
        where: {
          ...(global ? {} : { schoolId: schoolId! }),
          role: { not: "SUPER_ADMIN" },
        },
        include: { school: { select: { name: true } } },
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
      });
      sheets = [{
        name: "کاربران",
        rows: [
          ["کد ملی", "نام", "نام خانوادگی", "نقش", "موبایل", "ایمیل", "مدرسه", "وضعیت", "آخرین ورود"],
          ...users.map((u) => [
            u.nationalId,
            u.firstName,
            u.lastName,
            ROLE_LABELS[u.role] ?? u.role,
            u.phone ?? "",
            u.email ?? "",
            u.school?.name ?? "",
            u.isActive ? "فعال" : "غیرفعال",
            u.lastLoginAt ? u.lastLoginAt.toISOString().slice(0, 16).replace("T", " ") : "",
          ]),
        ],
      }];
      filename = `bahar-users-${todayStamp()}`;
    } else if (type === "classes") {
      if (global) {
        return apiErr(400, "برای خروجی کلاس‌ها ابتدا وارد پنل یک مدرسه شوید (صفحه «مدارس»).", "NO_SCHOOL");
      }
      const classes = await db.class.findMany({
        where: { schoolId: schoolId! },
        include: {
          homeroomTeacher: { select: { firstName: true, lastName: true } },
          students: { where: { status: "ACTIVE" }, select: { id: true } },
        },
        orderBy: { name: "asc" },
      });
      sheets = [{
        name: "کلاس‌ها",
        rows: [
          ["نام کلاس", "پایه", "رشته", "معلم راهنما", "تعداد دانش‌آموز"],
          ...classes.map((c) => [
            c.name,
            c.grade ?? "",
            c.field ?? "",
            c.homeroomTeacher ? `${c.homeroomTeacher.firstName} ${c.homeroomTeacher.lastName}` : "",
            c.students.length,
          ]),
        ],
      }];
      filename = `bahar-classes-${todayStamp()}`;
    } else if (type === "grades") {
      if (global) {
        return apiErr(400, "برای خروجی نمرات ابتدا وارد پنل یک مدرسه شوید (صفحه «مدارس»).", "NO_SCHOOL");
      }
      const grades = await db.gradeRecord.findMany({
        where: { student: { schoolId: schoolId! } },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true, nationalId: true } }, class: { select: { name: true } } } },
          subject: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20000,
      });
      const schoolScale = (await db.school.findUnique({ where: { id: schoolId! }, select: { gradingScale: true } }))?.gradingScale ?? "SCORE20";
      sheets = [{
        name: "نمرات",
        rows: [
          ["نام دانش‌آموز", "کد ملی", "کلاس", "درس", "نوبت", "نوع ارزیابی", "نمره", "از", "نمره در مقیاس مدرسه", "ضریب", "نهایی‌شده", "یادداشت"],
          ...grades.map((g) => [
            `${g.student.user.firstName} ${g.student.user.lastName}`,
            g.student.user.nationalId,
            g.student.class?.name ?? "",
            g.subject.name,
            g.term === 1 ? "نوبت اول" : "نوبت دوم",
            GRADE_KIND_LABELS[g.kind] ?? g.kind,
            g.score,
            g.maxScore,
            convertScore(g.maxScore > 0 ? (g.score / g.maxScore) * 20 : 0, schoolScale),
            g.weight,
            g.locked ? "بله" : "خیر",
            g.note ?? "",
          ]),
        ],
      }];
      filename = `bahar-grades-${todayStamp()}`;
    } else if (type === "attendance") {
      if (global) {
        return apiErr(400, "برای خروجی حضور و غیاب ابتدا وارد پنل یک مدرسه شوید (صفحه «مدارس»).", "NO_SCHOOL");
      }
      const records = await db.attendance.findMany({
        where: { student: { schoolId: schoolId! } },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true, nationalId: true } }, class: { select: { name: true } } } },
        },
        orderBy: [{ date: "desc" }, { period: "asc" }],
        take: 30000,
      });
      // مدل Attendance رابطهٔ subject ندارد — نام درس‌ها جدا بارگذاری و در حافظه وصل می‌شود
      const subjectIds = [...new Set(records.map((a) => a.subjectId).filter((x): x is string => !!x))];
      const subjects = subjectIds.length
        ? await db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } })
        : [];
      const subjectName = new Map(subjects.map((s) => [s.id, s.name]));
      sheets = [{
        name: "حضور و غیاب",
        rows: [
          ["نام دانش‌آموز", "کد ملی", "کلاس", "تاریخ", "زنگ", "درس", "وضعیت", "یادداشت"],
          ...records.map((a) => [
            `${a.student.user.firstName} ${a.student.user.lastName}`,
            a.student.user.nationalId,
            a.student.class?.name ?? "",
            a.date,
            a.period === 0 ? "کل روز" : a.period,
            a.subjectId ? subjectName.get(a.subjectId) ?? "" : "",
            ATTENDANCE_LABELS[a.status] ?? a.status,
            a.note ?? "",
          ]),
        ],
      }];
      filename = `bahar-attendance-${todayStamp()}`;
    } else {
      // fees
      if (global) {
        return apiErr(400, "برای خروجی امور مالی ابتدا وارد پنل یک مدرسه شوید (صفحه «مدارس»).", "NO_SCHOOL");
      }
      const fees = await db.studentFee.findMany({
        where: { schoolId: schoolId! },
        include: {
          student: { include: { user: { select: { firstName: true, lastName: true, nationalId: true } } } },
        },
        orderBy: { createdAt: "desc" },
        take: 20000,
      });
      sheets = [{
        name: "امور مالی",
        rows: [
          ["نام دانش‌آموز", "کد ملی", "عنوان", "مبلغ (تومان)", "وضعیت", "سررسید", "تاریخ پرداخت", "یادداشت"],
          ...fees.map((f) => [
            `${f.student.user.firstName} ${f.student.user.lastName}`,
            f.student.user.nationalId,
            f.title,
            f.amount,
            FEE_STATUS_LABELS[f.status] ?? f.status,
            f.dueDate ? f.dueDate.toISOString().slice(0, 10) : "",
            f.paidAt ? f.paidAt.toISOString().slice(0, 10) : "",
            f.note ?? "",
          ]),
        ],
      }];
      filename = `bahar-fees-${todayStamp()}`;
    }

    if (sheets.every((s) => s.rows.length <= 1)) {
      return apiErr(404, "داده‌ای برای خروجی وجود ندارد.", "EMPTY");
    }

    await audit({
      user: me,
      action: format === "csv" ? "اکسپورت CSV" : "اکسپورت اکسل",
      entityType: "FILE",
      meta: { type, format, rows: sheets[0]?.rows.length ?? 0, schoolId: schoolId ?? undefined },
      schoolId: schoolId ?? undefined,
    });

    if (format === "csv") {
      return new NextResponse(toCsv(sheets[0]?.rows ?? []), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": contentDispositionFilename(`${filename}.csv`),
          "Cache-Control": "no-store",
        },
      });
    }

    const buf = await buildExcel(sheets);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDispositionFilename(`${filename}.xlsx`),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
