import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  hashPassword, generatePassword, isValidNationalId, isValidShadNumber,
} from "@/lib/auth";
import {
  requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor, demoWriteBlock, toDate } from "@/lib/api";
import {
  ROLE_LABELS, DEFAULT_DEPUTY_PERMISSIONS, DEFAULT_TEACHER_PERMISSIONS,
  PERMISSION_CATALOG, DEFAULT_ADMIN_PERMISSIONS, ALL_SERVICE_PERMISSIONS,
  parsePermissions, hasPermission,
} from "@/lib/roles";
import { deliverCredentials } from "@/lib/shad";
import { enDigits } from "@/lib/persian";
import { avatarApiFields } from "@/lib/avatar";

const VALID_ROLES = ["ADMIN", "MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "STUDENT", "PARENT"];
const EDITABLE_TEXT_FIELDS = [
  "firstName", "lastName", "fatherName", "birthPlace", "education",
  "fieldOfStudy", "jobTitle", "address", "email", "staffCode",
] as const;
const EDITABLE_LTR_FIELDS = [
  "phone", "homePhone", "shadNumber", "postalCode",
] as const;

/** GET /api/users?role=&q=&schoolId=&includeInactive= — فهرست بر اساس دامنه اختیار */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") ?? undefined;
    const q = searchParams.get("q")?.trim();
    const schoolIdParam = searchParams.get("schoolId") ?? undefined;
    const includeInactive = searchParams.get("includeInactive") === "1";
    // کوکی مدرسه فعال فقط با اعتبارسنجی نقش (قابل جعل از کلاینت است)
    const actingCookie = actingSchoolIdFor(req, me);

    const isSuper = me.role === "SUPER_ADMIN";
    const isAdmin = me.role === "ADMIN";
    const isManager = me.role === "MANAGER";
    const isService = isSuper || isAdmin;

    if (!isService && !isManager) {
      const listable =
        (role === "TEACHER" && hasPermission(me, "manage_teachers")) ||
        (role === "PARENT" && hasPermission(me, "manage_students"));
      if (!listable) {
        throw new ApiError(403, "FORBIDDEN", "مشاهده فهرست کاربران برای شما مجاز نیست.");
      }
    }
    if (isAdmin && !hasPermission(me, "view_users") && !isManager) {
      // ادمین داخل پنل مدرسه هم می‌تواند ببیند
      if (!actingCookie || !hasPermission(me, "enter_school_panel")) {
        throw new ApiError(403, "FORBIDDEN", "دسترسی «مشاهده کاربران» برای شما فعال نیست.");
      }
    }

    // مدرسه هدف: مدیر/معاون → مدرسه خودشان؛ ادمین → کوکی پنل یا پارامتر
    let schoolId: string | undefined;
    if (isService) {
      // سوپرادمین با پارامتر هر مدرسه‌ای را می‌بیند؛ ادمین سرویس فقط مدرسه‌ای
      // که وارد پنلش شده است — پارامتر آزاد برای ادمین یعنی دور زدن پنل.
      schoolId = isSuper ? (actingCookie ?? schoolIdParam ?? undefined) : (actingCookie ?? undefined);
    } else {
      schoolId = me.schoolId ?? undefined;
      if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "به مدرسه‌ای متصل نیستید.");
    }

    const where: Record<string, unknown> = {};
    if (role) where.role = role;
    if (schoolId) where.schoolId = schoolId;
    if (!includeInactive) where.isActive = true;
    if (q) {
      where.OR = [
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { nationalId: { contains: q } },
      ];
    }

    const users = await db.user.findMany({
      where,
      select: {
        id: true, nationalId: true, role: true, firstName: true, lastName: true,
        fatherName: true, gender: true, phone: true, homePhone: true, shadNumber: true,
        email: true, address: true, postalCode: true, birthPlace: true, photoUrl: true,
        profileImageType: true, avatarConfig: true,
        education: true, fieldOfStudy: true, jobTitle: true, staffCode: true,
        birthDate: true, hireDate: true, isActive: true,
        permissions: true, lastLoginAt: true, mustChangePassword: true, createdAt: true,
        schoolId: true,
        school: { select: { id: true, name: true } },
        studentProfile: { select: { studentNumber: true, classId: true, class: { select: { name: true } } } },
        parentOf: { select: { student: { select: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    });

    return apiOk({
      users: users.map((u) => ({
        ...u,
        ...avatarApiFields(u),
        roleLabel: ROLE_LABELS[u.role] ?? u.role,
        permissions: parsePermissions(u.permissions),
        hasTempPassword: u.mustChangePassword,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/users — ساخت کاربر با رمز تصادفی + ارسال با شاد */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<Record<string, string | string[] | boolean | undefined>>(req);

    const role = String(body.role ?? "");
    if (!VALID_ROLES.includes(role)) {
      return apiErr(400, "نقش نامعتبر است.", "BAD_ROLE");
    }

    const isSuper = me.role === "SUPER_ADMIN";
    const isAdmin = me.role === "ADMIN";
    const isManager = me.role === "MANAGER";
    const actingCookie = actingSchoolIdFor(req, me);

    // ── قواعد اختیار ──
    if (isAdmin || isSuper) {
      // در پنل مدرسه (کوکی) ادمین می‌تواند نقش‌های مدرسه‌ای بسازد
      const inSchoolPanel = !!actingCookie && hasPermission(me, "enter_school_panel");
      if (role === "ADMIN") {
        if (!isSuper) return apiErr(403, "فقط مدیر کل سامانه می‌تواند ادمین سرویس بسازد.", "FORBIDDEN");
        if (!hasPermission(me, "manage_admins")) return apiErr(403, "دسترسی ساخت ادمین ندارید.", "FORBIDDEN");
      } else if (role === "MANAGER") {
        if (!inSchoolPanel && !hasPermission(me, "create_schools") && !hasPermission(me, "create_users")) {
          return apiErr(403, "ساخت مدیر مدرسه در صفحه «مدارس» یا پنل مدرسه انجام می‌شود.", "FORBIDDEN");
        }
      } else if (!hasPermission(me, "create_users") && !inSchoolPanel) {
        return apiErr(403, "دسترسی ساخت کاربر ندارید.", "FORBIDDEN");
      }
    } else if (isManager) {
      // راند ۱۸: سرایدار هم توسط مدیر ساخته می‌شود
      if (!["DEPUTY", "TEACHER", "PARENT", "CUSTODIAN"].includes(role)) {
        return apiErr(403, "مدیر مدرسه فقط معاون، معلم، ولی و سرایدار می‌تواند بسازد.", "FORBIDDEN");
      }
    } else {
      // ── سایر نقش‌ها (معاون/معلم دارای مجوز) — فقط معلم/ولی قابل ساخت است ──
      // نقش‌های MANAGER/ADMIN/STUDENT از این مسیر قابل ساخت نیستند:
      // مدیر مدرسه از صفحه «مدارس»، ادمین فقط توسط سوپرادمین،
      // و دانش‌آموز فقط از مسیر اختصاصی /api/students (با پرونده و شماره دانش‌آموزی) ساخته می‌شود.
      if (role === "TEACHER") {
        if (!hasPermission(me, "manage_teachers")) {
          return apiErr(403, "دسترسی ساخت معلم ندارید.", "FORBIDDEN");
        }
      } else if (role === "PARENT") {
        if (!hasPermission(me, "manage_students")) {
          return apiErr(403, "دسترسی ساخت ولی ندارید.", "FORBIDDEN");
        }
      } else {
        return apiErr(403, "برای ساخت کاربر با این نقش دسترسی ندارید.", "FORBIDDEN");
      }
    }

    // ── کد ملی: فقط سوپرادمین می‌تواند کد نامعتبر وارد کند ──
    const nationalId = enDigits(String(body.nationalId ?? "")).trim();
    const forceInvalid = body.forceInvalidNationalId === true;
    if (!/^\d{6,12}$/.test(nationalId)) {
      return apiErr(400, "کد ملی باید ۶ تا ۱۲ رقم باشد.", "BAD_NATIONAL_ID");
    }
    if (!isValidNationalId(nationalId)) {
      if (isSuper && forceInvalid) {
        // سوپرادمین با تایید صریح
      } else if (isSuper) {
        return apiErr(400, "کد ملی از نظر الگوریتم نامعتبر است — برای درج دستی، گزینه «ثبت با کد نامعتبر» را فعال کنید.", "INVALID_NATIONAL_ID_CONFIRM");
      } else {
        return apiErr(400, "کد ملی نامعتبر است.", "BAD_NATIONAL_ID");
      }
    }
    const exists = await db.user.findUnique({ where: { nationalId } });
    if (exists) return apiErr(409, "این کد ملی قبلاً ثبت شده است.", "DUPLICATE");

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    if (firstName.length < 2 || lastName.length < 2) {
      return apiErr(400, "نام و نام خانوادگی الزامی است.", "BAD_NAME");
    }

    const shadNumber = body.shadNumber ? enDigits(String(body.shadNumber)).trim() : null;
    if (shadNumber && !isValidShadNumber(shadNumber)) {
      return apiErr(400, "شماره شاد باید موبایل معتبر (۰۹…) باشد.", "BAD_SHAD");
    }
    const phone = body.phone ? enDigits(String(body.phone)).trim() : null;

    // مدرسه مقصد
    let schoolId: string | null = null;
    if (me.role === "SUPER_ADMIN" || me.role === "ADMIN") {
      schoolId = body.schoolId ? String(body.schoolId) : (actingCookie ?? null);
    } else {
      schoolId = me.schoolId;
    }
    // FIX (راند ۱۶): مدرسه مقصد باید واقعاً وجود داشته باشد — قبلاً FK 500 می‌داد
    // راند ۱۸: ماژول‌های مدرسه هم خوانده می‌شود (شاد/سرایدار قابل خاموش‌کردن)
    let schoolRow: { id: string; name: string; shadEnabled: boolean; custodianEnabled: boolean } | null = null;
    if (schoolId) {
      schoolRow = await db.school.findUnique({
        where: { id: schoolId },
        select: { id: true, name: true, shadEnabled: true, custodianEnabled: true },
      });
      if (!schoolRow) return apiErr(404, "مدرسه مقصد یافت نشد.", "SCHOOL_NOT_FOUND");
    }
    // راند ۱۸: سرایدار باید به مدرسه‌ای وصل باشد و ماژولش روشن باشد
    if (role === "CUSTODIAN") {
      if (!schoolId) return apiErr(400, "سرایدار باید به یک مدرسه متصل باشد.", "NO_SCHOOL");
      if (schoolRow && !schoolRow.custodianEnabled) {
        return apiErr(403, "نقش سرایدار در این مدرسه غیرفعال است؛ اول از تنظیمات مدرسه فعالش کنید.", "CUSTODIAN_DISABLED");
      }
    }

    // مجوزهای نقش
    let permissions: string[] = [];
    const permInput = Array.isArray(body.permissions) ? (body.permissions as string[]) : null;
    if (role === "ADMIN") {
      permissions = (permInput ?? DEFAULT_ADMIN_PERMISSIONS).filter((p) => ALL_SERVICE_PERMISSIONS.includes(p));
    } else if (role === "DEPUTY") {
      permissions = permInput?.filter((p) => PERMISSION_CATALOG.some((c) => c.key === p)) ?? DEFAULT_DEPUTY_PERMISSIONS;
    } else if (role === "TEACHER") {
      permissions = permInput?.filter((p) => PERMISSION_CATALOG.some((c) => c.key === p)) ?? DEFAULT_TEACHER_PERMISSIONS;
    }

    if (body.birthDate && !toDate(body.birthDate)) return apiErr(400, "تاریخ تولد نامعتبر است.", "BAD_DATE");
    if (body.hireDate && !toDate(body.hireDate)) return apiErr(400, "تاریخ استخدام نامعتبر است.", "BAD_DATE");

    // ── رمز تصادفی ──
    const password = generatePassword();

    const user = await db.user.create({
      data: {
        nationalId,
        passwordHash: hashPassword(password),
        tempPassword: password,
        mustChangePassword: true,
        role,
        permissions: JSON.stringify(permissions),
        firstName,
        lastName,
        fatherName: body.fatherName ? String(body.fatherName).trim() : null,
        gender: body.gender ? String(body.gender) : null,
        birthDate: body.birthDate ? toDate(body.birthDate) : null,
        birthPlace: body.birthPlace ? String(body.birthPlace) : null,
        phone,
        homePhone: body.homePhone ? enDigits(String(body.homePhone)).trim() : null,
        shadNumber,
        email: body.email ? String(body.email) : null,
        address: body.address ? String(body.address) : null,
        postalCode: body.postalCode ? enDigits(String(body.postalCode)).trim() : null,
        education: body.education ? String(body.education) : null,
        fieldOfStudy: body.fieldOfStudy ? String(body.fieldOfStudy) : null,
        jobTitle: body.jobTitle ? String(body.jobTitle) : null,
        hireDate: body.hireDate ? toDate(body.hireDate) : null,
        staffCode: body.staffCode ? String(body.staffCode) : null,
        schoolId: role === "ADMIN" ? null : schoolId,
        createdBy: me.id,
      },
    });

    if (role === "MANAGER" && schoolId) {
      await db.school.update({ where: { id: schoolId }, data: { managerId: user.id } });
    }

    // ── ارسال اعتبارنامه با شاد (راند ۱۸: فقط وقتی شاد مدرسه روشن باشد) ──
    let shadDelivery: { ok: boolean; error?: string; status?: string } = { ok: false, error: "NO_SHAD_NUMBER", status: "FAILED" };
    if (shadNumber && schoolId && schoolRow?.shadEnabled !== false) {
      shadDelivery = await deliverCredentials(
        { ...user, schoolId, tempPassword: password },
        schoolRow?.name ?? "مدرسه",
        ROLE_LABELS[role]
      );
    } else if (shadNumber && schoolId && schoolRow?.shadEnabled === false) {
      // شاد برای این مدرسه خاموش است — اعتبارنامه فقط روی صفحه نمایش داده می‌شود
      shadDelivery = { ok: false, error: "SHAD_DISABLED", status: "SKIPPED" };
    }

    await audit({
      user: me, action: "CREATE_USER", entityType: "USER", entityId: user.id,
      meta: { role, nationalId, shadDelivery: shadDelivery.status ?? shadDelivery.error },
      schoolId,
    });

    return apiOk({
      user: { id: user.id, nationalId, role, firstName, lastName },
      password,
      shadDelivery,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    if (id === me.id) return apiErr(400, "حساب خودتان را نمی‌توانید حذف کنید.", "SELF");
    const row = await db.user.findUnique({ where: { id }, select: { schoolId: true, role: true } });
    if (!row) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
    if (row.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") return apiErr(403, "حذف مدیر کل فقط توسط مدیر کل ممکن است.", "FORBIDDEN");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.user.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
