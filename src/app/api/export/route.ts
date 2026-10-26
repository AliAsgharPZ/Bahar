import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiErr, handleApiError, actingSchoolIdFor, rateLimit, ipOf, audit } from "@/lib/api";
import { buildExcel, contentDispositionFilename, type ExcelSheet } from "@/lib/excel";
import { ROLE_LABELS } from "@/lib/roles";
import { STUDENT_STATUS_LABELS, PARENT_RELATION_LABELS } from "@/lib/persian";

/* ============================================================
   بهار | اکسپورت انبوه (راند ۱۸) — GET /api/export?type=...&format=xlsx
   دانش‌آموزان / کاربران / کلاس‌ها به‌صورت فایل اکسل واقعی.
   دامنه: مدیر/معاون → مدرسه خودشان؛ سوپرادمین/ادمین → پنل فعال
   یا (بدون پنل) کل سامانه.
   ============================================================ */

const TYPES = ["students", "users", "classes"] as const;

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
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
    } else {
      // classes
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
    }

    if (sheets.every((s) => s.rows.length <= 1)) {
      return apiErr(404, "داده‌ای برای خروجی وجود ندارد.", "EMPTY");
    }

    const buf = await buildExcel(sheets);

    await audit({
      user: me,
      action: "اکسپورت اکسل",
      entityType: "FILE",
      meta: { type, rows: sheets[0]?.rows.length ?? 0, schoolId: schoolId ?? undefined },
      schoolId: schoolId ?? undefined,
    });

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
