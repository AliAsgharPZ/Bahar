import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, apiOk, handleApiError, ApiError, actingSchoolIdFor, readJson, audit } from "@/lib/api";
import { planStatusOf } from "@/lib/plans";
import { avatarApiFields } from "@/lib/avatar";
import { enDigits } from "@/lib/persian";

/** اطلاعات کامل کاربر جاری + زمینه نقش + مدرسه فعال (پنل) */
export async function GET(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me) throw new ApiError(401, "UNAUTHORIZED", "وارد نشده‌اید.");

    // مدرسه فعال برای ادمین‌ها (ورود به پنل مدرسه) — با اعتبارسنجی نقش، نه اعتماد به کوکی خام
    const actingSchoolId = actingSchoolIdFor(req, me);
    const actingSchool = actingSchoolId
      ? await db.school.findUnique({ where: { id: actingSchoolId }, select: { id: true, name: true, code: true, shadEnabled: true, custodianEnabled: true } })
      : null;

    const user = await db.user.findUnique({
      where: { id: me.id },
      include: {
        school: true,
        studentProfile: {
          include: {
            class: { include: { school: { select: { name: true } } } },
            parents: {
              include: {
                parentUser: {
                  select: {
                    id: true, firstName: true, lastName: true, nationalId: true,
                    phone: true, shadNumber: true, jobTitle: true, education: true, role: true,
                  },
                },
              },
            },
          },
        },
        parentOf: {
          include: {
            student: {
              include: {
                class: true,
                user: { select: { id: true, firstName: true, lastName: true, nationalId: true, profileImageType: true, photoUrl: true, avatarConfig: true } },
                parents: {
                  include: {
                    parentUser: { select: { id: true, firstName: true, lastName: true, profileImageType: true, photoUrl: true, avatarConfig: true } },
                  },
                },
              },
            },
          },
        },
        homeroomClasses: { select: { id: true, name: true, grade: true } },
        teacherAssignments: {
          include: {
            class: { select: { id: true, name: true, grade: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!user) throw new ApiError(404, "NOT_FOUND", "کاربر یافت نشد.");

    return apiOk({
      user: {
        id: user.id,
        nationalId: user.nationalId,
        role: user.role,
        permissions: me.permissions,
        firstName: user.firstName,
        lastName: user.lastName,
        fatherName: user.fatherName,
        motherName: null,
        gender: user.gender,
        birthDate: user.birthDate,
        birthPlace: user.birthPlace,
        phone: user.phone,
        homePhone: user.homePhone,
        shadNumber: user.shadNumber,
        email: user.email,
        address: user.address,
        postalCode: user.postalCode,
        education: user.education,
        fieldOfStudy: user.fieldOfStudy,
        jobTitle: user.jobTitle,
        staffCode: user.staffCode,
        hireDate: user.hireDate,
        mustChangePassword: user.mustChangePassword,
        lastLoginAt: user.lastLoginAt,
        isActive: user.isActive,
        langCode: user.langCode,
        ...avatarApiFields(user),
        school: user.school
          ? {
              id: user.school.id, name: user.school.name, code: user.school.code,
              managerId: user.school.managerId, logoUrl: user.school.logoUrl,
              province: user.school.province, county: user.school.county ?? user.school.city,
              planStatus: planStatusOf(user.school.plan, user.school.planExpiresAt),
            }
          : null,
        actingSchool: actingSchool ? { ...actingSchool, planStatus: null } : null,
        hasPendingChanges: await db.profileChangeRequest.count({
          where: { userId: me.id, status: "PENDING" },
        }) > 0,
        studentProfile: user.studentProfile,
        children: user.parentOf.map((sp) => ({
          relation: sp.relation,
          student: {
            ...sp.student,
            user: { ...sp.student.user, ...avatarApiFields(sp.student.user) },
            parents: sp.student.parents.map((p) => ({
              relation: p.relation,
              parentUser: { ...p.parentUser, ...avatarApiFields(p.parentUser) },
            })),
          },
        })),
        homeroomClasses: user.homeroomClasses,
        teachingAssignments: user.teacherAssignments,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/**
 * PATCH /api/auth/me — ویرایش مستقیم فیلدهای پایهٔ «خودِ» نقش‌های سرویس
 * (سوپرادمین/ادمین که approver ندارند). کاربران مدرسه‌ای همچنان از
 * جریان تایید مدیر (profile-requests) استفاده می‌کنند.
 */
export async function PATCH(req: NextRequest) {
  try {
    const me = await getSessionUser(req);
    if (!me) throw new ApiError(401, "UNAUTHORIZED", "وارد نشده‌اید.");
    if (me.role !== "SUPER_ADMIN" && me.role !== "ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "برای ویرایش مشخصات، درخواست تایید به مدیر مدرسه ارسال می‌شود (از همان دکمهٔ ویرایش).");
    }
    const body = await readJson<Record<string, unknown>>(req);

    const data: Record<string, unknown> = {};
    const clean = (k: string) => (body[k] !== undefined ? String(body[k]).trim() : undefined);
    if (clean("firstName")) data.firstName = clean("firstName");
    if (clean("lastName")) data.lastName = clean("lastName");
    if (body.phone !== undefined) data.phone = enDigits(String(body.phone)).trim() || null;
    if (body.email !== undefined) data.email = clean("email") || null;
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, "NO_FIELDS", "فیلدی برای تغییر ارسال نشده است.");
    }
    await db.user.update({ where: { id: me.id }, data });
    await audit({ user: me, action: "UPDATE_OWN_PROFILE", entityType: "USER", entityId: me.id, meta: { fields: Object.keys(data) } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
