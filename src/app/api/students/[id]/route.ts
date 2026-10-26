import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generatePassword, isValidShadNumber, isValidNationalId } from "@/lib/auth";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor } from "@/lib/api";
import { ROLE_LABELS, hasPermission } from "@/lib/roles";
import { avatarApiFields } from "@/lib/avatar";
import { deliverCredentials } from "@/lib/shad";
import { enDigits } from "@/lib/persian";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/students/[id] — پرونده کامل: اطلاعات، اولیا، نمرات، حضورغیاب */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const student = await db.student.findUnique({
      where: { id },
      include: {
        user: true,
        class: true,
        parents: { include: { parentUser: { select: { id: true, nationalId: true, firstName: true, lastName: true, phone: true, shadNumber: true, jobTitle: true, education: true, address: true, postalCode: true, gender: true, isActive: true, profileImageType: true, photoUrl: true, avatarConfig: true } } } },
        attendances: { orderBy: { date: "desc" }, take: 120 },
        gradeRecords: { include: { subject: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const isManager = me.role === "MANAGER" && me.schoolId === student.schoolId;
    // FIX (راند ۱۶): معاون با دسترسی «مدیریت دانش‌آموزان» هم پرونده را می‌بیند
    const isDeputyAllowed = me.role === "DEPUTY" && me.schoolId === student.schoolId && hasPermission(me, "manage_students");
    const isSelf = student.userId === me.id;
    const isMyChild = me.role === "PARENT" && student.parents.some((p) => p.parentUserId === me.id);
    // A teacher sees a student's full file only if they actually teach the
    // student's class (same check the grades/attendance routes enforce) —
    // being a teacher anywhere in the school is not enough.
    const isTeacherOf = me.role === "TEACHER" && me.schoolId === student.schoolId && !!student.classId &&
      (student.class?.homeroomTeacherId === me.id ||
        !!(await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId: student.classId } })));
    if (!isService && !isManager && !isDeputyAllowed && !isSelf && !isMyChild && !isTeacherOf) {
      return apiErr(403, "مشاهده این دانش‌آموز برای شما مجاز نیست.", "FORBIDDEN");
    }

    return apiOk({
      student: {
        ...student,
        user: { ...student.user, passwordHash: undefined, tempPassword: undefined, ...avatarApiFields(student.user) },
        parents: student.parents.map((p) => ({ ...p, parentUser: { ...p.parentUser, ...avatarApiFields(p.parentUser) } })),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/students/[id] — ویرایش دانش‌آموز + افزودن/حذف ولی */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const student = await db.student.findUnique({ where: { id }, include: { user: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    // سوپرادمین همیشه؛ ادمین سرویس فقط با edit_users و داخل پنل همان مدرسه (کوکی اعتبارسنجی‌شده)
    const isSuper = me.role === "SUPER_ADMIN";
    const actingAdmin = me.role === "ADMIN" && hasPermission(me, "edit_users") && actingSchoolIdFor(req, me) === student.schoolId;
    const isManager = me.role === "MANAGER" && me.schoolId === student.schoolId;
    // FIX (راند ۱۶): معاون با «مدیریت دانش‌آموزان» هم می‌تواند ویرایش کند
    const isDeputyAllowed = me.role === "DEPUTY" && me.schoolId === student.schoolId && hasPermission(me, "manage_students");
    if (!isSuper && !actingAdmin && !isManager && !isDeputyAllowed) {
      throw new ApiError(403, "FORBIDDEN", "ویرایش دانش‌آموز فقط توسط مدیر مدرسه یا معاونِ دارای دسترسی انجام می‌شود.");
    }

    const body = await readJson<Record<string, string | boolean | { nationalId?: string }[] | undefined>>(req);
    const userData: Record<string, unknown> = {};
    const studentData: Record<string, unknown> = {};

    const str = (k: string, target: Record<string, unknown>) => {
      if (body[k] !== undefined) target[k] = String(body[k]).trim() || null;
    };
    str("firstName", userData); str("lastName", userData);
    str("fatherName", userData); str("birthPlace", userData);
    if (body.gender !== undefined) userData.gender = String(body.gender);
    if (body.birthDate !== undefined) {
      if (body.birthDate) {
        const d = new Date(String(body.birthDate));
        if (isNaN(d.getTime())) return apiErr(400, "تاریخ تولد نامعتبر است.", "BAD_DATE");
        userData.birthDate = d;
      } else userData.birthDate = null;
    }
    if (body.phone !== undefined) userData.phone = enDigits(String(body.phone)).trim() || null;
    if (body.address !== undefined) userData.address = String(body.address);
    if (body.shadNumber !== undefined) {
      const shad = enDigits(String(body.shadNumber)).trim();
      if (shad && !isValidShadNumber(shad)) return apiErr(400, "شماره شاد نامعتبر است.", "BAD_SHAD");
      userData.shadNumber = shad || null;
    }
    if (body.classId !== undefined) {
      const classId = body.classId ? String(body.classId) : null;
      if (classId) {
        const cls = await db.class.findUnique({ where: { id: classId } });
        if (!cls || cls.schoolId !== student.schoolId) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
      }
      studentData.classId = classId;
    }
    str("studentNumber", studentData); str("entryYear", studentData);
    str("previousSchool", studentData); str("healthNotes", studentData);
    str("status", studentData);
    if (body.isActive !== undefined) userData.isActive = Boolean(body.isActive);

    await db.user.update({ where: { id: student.userId }, data: userData });
    await db.student.update({ where: { id }, data: studentData });

    // ── مدیریت اولیا ──
    let addedParent: Record<string, unknown> | null = null;
    const removeParentIds = (body as Record<string, unknown>).removeParentIds;
    if (Array.isArray(removeParentIds)) {
      for (const pid of removeParentIds as string[]) {
        await db.studentParent.deleteMany({ where: { studentId: id, parentUserId: String(pid) } });
      }
    }
    const addParent = (body as Record<string, unknown>).addParent as ParentInput | undefined;
    if (addParent && addParent.nationalId) {
      const pNational = enDigits(String(addParent.nationalId)).trim();
      if (!isValidNationalId(pNational)) return apiErr(400, "کد ملی ولی نامعتبر است.", "BAD_NATIONAL_ID");
      const relation = ["FATHER", "MOTHER", "GUARDIAN"].includes(String(addParent.relation)) ? String(addParent.relation) : "GUARDIAN";
      let parentUser = await db.user.findUnique({ where: { nationalId: pNational } });
      let pPassword: string | undefined;
      if (!parentUser) {
        const pFirst = String(addParent.firstName ?? "").trim();
        const pLast = String(addParent.lastName ?? "").trim();
        if (pFirst.length < 2 || pLast.length < 2) {
          return apiErr(400, "نام و نام خانوادگی ولی الزامی است.", "BAD_PARENT_NAME");
        }
        pPassword = generatePassword();
        parentUser = await db.user.create({
          data: {
            nationalId: pNational,
            passwordHash: hashPassword(pPassword),
            tempPassword: pPassword,
            mustChangePassword: true,
            role: "PARENT",
            firstName: pFirst,
            lastName: pLast,
            phone: addParent.phone ? enDigits(String(addParent.phone)).trim() : null,
            shadNumber: addParent.shadNumber ? enDigits(String(addParent.shadNumber)).trim() : null,
            jobTitle: addParent.jobTitle ? String(addParent.jobTitle) : null,
            schoolId: student.schoolId,
            createdBy: me.id,
          },
        });
      } else if (parentUser.role !== "PARENT") {
        return apiErr(409, "این کد ملی برای نقش دیگری ثبت شده است.", "ROLE_CONFLICT");
      }
      const linkExists = await db.studentParent.findFirst({ where: { studentId: id, parentUserId: parentUser.id } });
      if (!linkExists) {
        await db.studentParent.create({
          data: { studentId: id, parentUserId: parentUser.id, relation },
        });
      }
      let delivery: { ok: boolean; error?: string } | undefined;
      if (pPassword && parentUser.shadNumber) {
        const school = await db.school.findUnique({ where: { id: student.schoolId } });
        delivery = await deliverCredentials(
          { ...parentUser, tempPassword: pPassword },
          school?.name ?? "مدرسه",
          "ولی دانش‌آموز"
        );
      }
      addedParent = {
        id: parentUser.id, nationalId: pNational,
        firstName: parentUser.firstName, lastName: parentUser.lastName,
        relation, password: pPassword, shadDelivery: delivery,
      };
    }

    // ── بازنشانی رمز ──
    let newPassword: string | null = null;
    if (body.resetPassword === true) {
      newPassword = generatePassword();
      await db.user.update({
        where: { id: student.userId },
        data: {
          passwordHash: hashPassword(newPassword),
          tempPassword: newPassword,
          mustChangePassword: true,
          failedAttempts: 0, lockedUntil: null,
        },
      });
      const school = await db.school.findUnique({ where: { id: student.schoolId } });
      if (student.user.shadNumber) {
        await deliverCredentials(
          { ...student.user, tempPassword: newPassword },
          school?.name ?? "مدرسه",
          "دانش‌آموز"
        );
      }
    }

    await audit({
      user: me, action: "UPDATE_STUDENT", entityType: "STUDENT", entityId: id,
      meta: { fields: [...Object.keys(userData), ...Object.keys(studentData)] },
      schoolId: student.schoolId,
    });

    return apiOk({ ok: true, password: newPassword, addedParent });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/students/[id] — غیرفعال‌سازی */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const student = await db.student.findUnique({ where: { id } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    // سوپرادمین همیشه؛ ادمین سرویس فقط با edit_users و داخل پنل همان مدرسه
    const isSuper = me.role === "SUPER_ADMIN";
    const actingAdmin = me.role === "ADMIN" && hasPermission(me, "edit_users") && actingSchoolIdFor(req, me) === student.schoolId;
    const deputyAdmin = me.role === "DEPUTY" && me.schoolId === student.schoolId && hasPermission(me, "manage_students"); // FIX راند ۱۶
    const isManager = me.role === "MANAGER" && me.schoolId === student.schoolId;
    if (!isSuper && !actingAdmin && !isManager && !deputyAdmin) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");

    await db.user.update({ where: { id: student.userId }, data: { isActive: false } });
    await db.student.update({ where: { id }, data: { status: "TRANSFERRED" } });
    await audit({ user: me, action: "DEACTIVATE_STUDENT", entityType: "STUDENT", entityId: id, schoolId: student.schoolId });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

type ParentInput = {
  nationalId?: string; firstName?: string; lastName?: string;
  relation?: string; phone?: string; shadNumber?: string; jobTitle?: string;
};
