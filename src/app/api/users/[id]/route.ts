import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generatePassword, isValidNationalId, isValidShadNumber } from "@/lib/auth";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor } from "@/lib/api";
import {
  ROLE_LABELS, PERMISSION_CATALOG, ALL_SERVICE_PERMISSIONS,
  parsePermissions, hasPermission,
} from "@/lib/roles";
import { deliverCredentials } from "@/lib/shad";
import { enDigits } from "@/lib/persian";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/users/[id] — پروفایل کامل + دانش‌آموز/اولیا */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;

    const user = await db.user.findUnique({
      where: { id },
      include: {
        school: { select: { id: true, name: true, code: true, province: true, county: true } },
        studentProfile: {
          include: {
            class: true,
            parents: { include: { parentUser: { select: { id: true, firstName: true, lastName: true, nationalId: true, phone: true, shadNumber: true, jobTitle: true, education: true, role: true } } } },
            attendances: { orderBy: { date: "desc" }, take: 60 },
          },
        },
        parentOf: { include: { student: { include: { class: true, user: { select: { firstName: true, lastName: true, nationalId: true } } } } } },
        teacherAssignments: { include: { class: true, subject: true } },
      },
    });
    if (!user) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");

    const sameSchool = me.schoolId && user.schoolId === me.schoolId;
    // Only SUPER_ADMIN operates across tenants; ADMIN is scoped to its own school.
    const isService = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && !!sameSchool);
    const isSelf = me.id === user.id;
    const isManagerOrPerm =
      (me.role === "MANAGER" && !!sameSchool) ||
      (sameSchool && (user.role === "TEACHER" ? hasPermission(me, "manage_teachers") : hasPermission(me, "manage_students")));
    let allowed = isService || isSelf || isManagerOrPerm;
    if (me.role === "PARENT" && user.role === "STUDENT") {
      const children = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const student = user.studentProfile ? children.some((c) => c.studentId === user.studentProfile!.id) : false;
      allowed = allowed || student;
    }
    if (me.role === "STUDENT" && user.role === "PARENT" && isSelf) allowed = true;
    if (!allowed) return apiErr(403, "مشاهده این کاربر برای شما مجاز نیست.", "FORBIDDEN");

    // ⚠ امنیت: هیچ‌وقت کل مدل کاربر را spread نکنید — passwordHash/tempPassword/tokenVersion نباید به بیرون نشت کنند
    const { passwordHash: _ph, tempPassword: _tp, tokenVersion: _tv, ...safeUser } = user;
    return apiOk({
      user: {
        ...safeUser,
        permissions: parsePermissions(user.permissions),
        roleLabel: ROLE_LABELS[user.role] ?? user.role,
        studentProfile: user.studentProfile
          ? {
              ...user.studentProfile,
              parents: user.studentProfile.parents.map((p) => ({
                ...p,
                parentUser: { ...p.parentUser, roleLabel: ROLE_LABELS[p.parentUser.role] },
              })),
            }
          : null,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/users/[id] — ویرایش «همه» مشخصات (حتی کد ملی/نقش/مدرسه)، فعال‌سازی، دسترسی‌ها، بازنشانی رمز */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const body = await readJson<Record<string, unknown>>(req);

    const user = await db.user.findUnique({
      where: { id },
      include: { studentProfile: { select: { id: true } } },
    });
    if (!user) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");

    const actingCookie = actingSchoolIdFor(req, me);
    const isSuper = me.role === "SUPER_ADMIN";
    const sameSchool = !!me.schoolId && user.schoolId === me.schoolId;
    const isManagerOfSchool =
      (me.role === "MANAGER" && !!sameSchool) ||
      (me.role === "ADMIN" && actingCookie === user.schoolId && hasPermission(me, "edit_users"));
    const canEditAdmins = isSuper || (me.role === "ADMIN" && hasPermission(me, "manage_admins"));
    if (!isSuper && !isManagerOfSchool) {
      // ادمین خارج از پنل مدرسه با دسترسی سراسری
      if (me.role === "ADMIN" && hasPermission(me, "edit_users") && !user.schoolId) {
        // مجاز برای کاربران بدون مدرسه (ادمین‌ها)
      } else {
        return apiErr(403, "ویرایش این کاربر برای شما مجاز نیست.", "FORBIDDEN");
      }
    }
    if ((user.role === "SUPER_ADMIN" || user.role === "ADMIN") && me.id !== user.id && !canEditAdmins) {
      return apiErr(403, "ویرایش ادمین‌های سرویس فقط با دسترسی «مدیریت ادمین‌ها» ممکن است.", "FORBIDDEN");
    }
    if (user.role === "SUPER_ADMIN" && me.role !== "SUPER_ADMIN") {
      return apiErr(403, "مدیر کل سامانه فقط توسط خود سوپرادمین قابل ویرایش است.", "FORBIDDEN");
    }
    if (user.id === me.id && body.role !== undefined && String(body.role) !== user.role) {
      return apiErr(400, "نمی‌توانید نقش خودتان را تغییر دهید.", "SELF_ROLE");
    }

    const data: Record<string, unknown> = {};
    const str = (k: string) => (body[k] !== undefined ? String(body[k]).trim() : undefined);
    const digits = (k: string) => (body[k] !== undefined ? enDigits(String(body[k])).trim() : undefined);

    if (str("firstName")) data.firstName = str("firstName");
    if (str("lastName")) data.lastName = str("lastName");
    if (body.fatherName !== undefined) data.fatherName = str("fatherName");
    if (body.gender !== undefined) data.gender = str("gender") || null;
    if (body.birthDate !== undefined) {
      if (body.birthDate) {
        const d = new Date(String(body.birthDate));
        if (isNaN(d.getTime())) return apiErr(400, "تاریخ تولد نامعتبر است.", "BAD_DATE");
        data.birthDate = d;
      } else data.birthDate = null;
    }
    if (body.birthPlace !== undefined) data.birthPlace = str("birthPlace");
    if (body.phone !== undefined) data.phone = digits("phone") || null;
    if (body.homePhone !== undefined) data.homePhone = digits("homePhone") || null;
    if (body.address !== undefined) data.address = str("address");
    if (body.postalCode !== undefined) data.postalCode = digits("postalCode") || null;
    if (body.email !== undefined) data.email = str("email") || null;
    if (body.education !== undefined) data.education = str("education");
    if (body.fieldOfStudy !== undefined) data.fieldOfStudy = str("fieldOfStudy");
    if (body.jobTitle !== undefined) data.jobTitle = str("jobTitle");
    if (body.staffCode !== undefined) data.staffCode = str("staffCode");
    if (body.hireDate !== undefined) {
      if (body.hireDate) {
        const d = new Date(String(body.hireDate));
        if (isNaN(d.getTime())) return apiErr(400, "تاریخ استخدام نامعتبر است.", "BAD_DATE");
        data.hireDate = d;
      } else data.hireDate = null;
    }
    if (body.photoUrl !== undefined) data.photoUrl = str("photoUrl") || null;
    if (body.isActive !== undefined) {
      data.isActive = Boolean(body.isActive);
      if (data.isActive) {
        data.failedAttempts = 0;
        data.lockedUntil = null;
      }
    }

    if (body.shadNumber !== undefined) {
      const shad = digits("shadNumber");
      if (shad && !isValidShadNumber(shad)) {
        return apiErr(400, "شماره شاد نامعتبر است.", "BAD_SHAD");
      }
      data.shadNumber = shad || null;
    }

    // ── تغییر کد ملی (حتی این!) — همان قاعده ساخت ──
    if (body.nationalId !== undefined) {
      const nid = enDigits(String(body.nationalId)).trim();
      if (nid !== user.nationalId) {
        if (!/^\d{6,12}$/.test(nid)) return apiErr(400, "کد ملی باید ۶ تا ۱۲ رقم باشد.", "BAD_NATIONAL_ID");
        const forceInvalid = body.forceInvalidNationalId === true;
        if (!isValidNationalId(nid)) {
          if (!(me.role === "SUPER_ADMIN" && forceInvalid)) {
            return apiErr(400, "کد ملی نامعتبر است؛ فقط مدیر کل سامانه می‌تواند کد نامعتبر ثبت کند.", "BAD_NATIONAL_ID");
          }
        }
        const dupe = await db.user.findUnique({ where: { nationalId: nid } });
        if (dupe) return apiErr(409, "این کد ملی برای کاربر دیگری ثبت شده است.", "DUPLICATE");
        data.nationalId = nid;
      }
    }

    // ── تغییر نقش ──
    if (body.role !== undefined && String(body.role) !== user.role) {
      const newRole = String(body.role);
      const VALID = ["ADMIN", "MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "STUDENT", "PARENT"];
      if (!VALID.includes(newRole)) return apiErr(400, "نقش نامعتبر است.", "BAD_ROLE");
      if (newRole === "ADMIN" && me.role !== "SUPER_ADMIN") {
        return apiErr(403, "فقط مدیر کل سامانه می‌تواند کاربر را به ادمین سرویس ارتقا دهد.", "FORBIDDEN");
      }
      if (newRole === "STUDENT" && !user.studentProfile) {
        return apiErr(400, "برای تبدیل به دانش‌آموز، پرونده دانش‌آموزی لازم است؛ از بخش «دانش‌آموزان» عمل کنید.", "NEED_STUDENT_PROFILE");
      }
      // راند ۱۸: سرایدار — ماژول باید در مدرسه مقصد روشن باشد
      if (newRole === "CUSTODIAN") {
        const targetSchoolId = (data.schoolId as string | undefined) ?? user.schoolId;
        if (!targetSchoolId) return apiErr(400, "سرایدار باید به یک مدرسه متصل باشد.", "NO_SCHOOL");
        const targetSchool = await db.school.findUnique({ where: { id: targetSchoolId }, select: { custodianEnabled: true } });
        if (targetSchool && !targetSchool.custodianEnabled) {
          return apiErr(403, "نقش سرایدار در این مدرسه غیرفعال است.", "CUSTODIAN_DISABLED");
        }
      }
      // مدیر → سلب مدیریت مدرسه
      if (user.role === "MANAGER") {
        const managed = await db.school.findFirst({ where: { managerId: user.id } });
        if (managed && newRole !== "MANAGER") {
          await db.school.update({ where: { id: managed.id }, data: { managerId: null } });
        }
      }
      if (newRole === "MANAGER") data.schoolId = data.schoolId ?? user.schoolId;
      if (newRole === "ADMIN") data.schoolId = null;
      data.role = newRole;
    }

    // ── تغییر مدرسه ──
    if (body.schoolId !== undefined) {
      const newSchool = body.schoolId ? String(body.schoolId) : null;
      if (newSchool) {
        const school = await db.school.findUnique({ where: { id: newSchool } });
        if (!school) return apiErr(404, "مدرسه مقصد یافت نشد.", "NOT_FOUND");
        // انتقال بین مدارس فقط برای نقش‌های سرویس؛ مدیر/معاون مدرسه فقط مدرسه خودشان
        if (me.role === "MANAGER" && newSchool !== me.schoolId) {
          return apiErr(403, "انتقال کاربر به مدرسه دیگر فقط توسط ادمین سرویس انجام می‌شود.", "FORBIDDEN");
        }
      } else if (me.role === "MANAGER") {
        return apiErr(403, "خارج کردن کاربر از مدرسه فقط توسط ادمین سرویس انجام می‌شود.", "FORBIDDEN");
      }
      data.schoolId = newSchool;
    }

    // ── دسترسی‌ها ──
    if (body.permissions !== undefined && Array.isArray(body.permissions)) {
      const raw = body.permissions as string[];
      if (user.role === "ADMIN") {
        if (me.role === "SUPER_ADMIN" || me.id === user.id) {
          data.permissions = JSON.stringify(raw.filter((p) => ALL_SERVICE_PERMISSIONS.includes(p)));
        } else {
          return apiErr(403, "سطح دسترسی ادمین‌ها را فقط مدیر کل سامانه تعیین می‌کند.", "FORBIDDEN");
        }
      } else if (user.role === "DEPUTY" || user.role === "TEACHER") {
        data.permissions = JSON.stringify(raw.filter((p) => PERMISSION_CATALOG.some((c) => c.key === p)));
      }
    }

    // ── بازنشانی رمز ──
    let newPassword: string | null = null;
    let shadDelivery: { ok: boolean; status?: string; error?: string } = { ok: false, error: "NO_SHAD_NUMBER" };
    if (body.resetPassword === true) {
      newPassword = generatePassword();
      data.passwordHash = hashPassword(newPassword);
      data.tempPassword = newPassword;
      data.mustChangePassword = true;
      data.failedAttempts = 0;
      data.lockedUntil = null;
    }

    await db.user.update({ where: { id }, data });
    // اگر به مدیر ارتقا یافته و مدرسه مشخص شده، متصل شود
    if (body.role === "MANAGER" && (data.schoolId as string | undefined)) {
      await db.school.update({ where: { id: data.schoolId as string }, data: { managerId: id } });
    }

    if (newPassword && user.shadNumber && user.schoolId) {
      const school = await db.school.findUnique({ where: { id: user.schoolId } });
      // راند ۱۸: شاد خاموش مدرسه → فقط نمایش روی صفحه (کپی)
      if (school && school.shadEnabled === false) {
        shadDelivery = { ok: false, error: "SHAD_DISABLED", status: "SKIPPED" };
      } else {
        const fresh = await db.user.findUnique({ where: { id } });
        shadDelivery = await deliverCredentials(
          { ...fresh!, schoolId: user.schoolId, tempPassword: newPassword },
          school?.name ?? "مدرسه",
          ROLE_LABELS[fresh?.role ?? user.role]
        );
      }
    }

    await audit({
      user: me, action: body.resetPassword === true ? "RESET_USER_PASSWORD" : "UPDATE_USER",
      entityType: "USER", entityId: id, meta: { fields: Object.keys(data) },
      schoolId: (data.schoolId as string) ?? user.schoolId,
    });

    return apiOk({ ok: true, password: newPassword, shadDelivery });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/users/[id]?mode=soft|hard — غیرفعال‌سازی یا حذف کامل از کل سامانه */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const mode = new URL(req.url).searchParams.get("mode") ?? "soft";
    const user = await db.user.findUnique({ where: { id } });
    if (!user) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
    if (user.id === me.id) return apiErr(400, "نمی‌توانید حساب خودتان را حذف کنید.", "SELF_DELETE");
    if (user.role === "SUPER_ADMIN") {
      return apiErr(403, "حساب مدیر کل سامانه قابل حذف نیست.", "FORBIDDEN");
    }

    const actingCookie = actingSchoolIdFor(req, me);
    const isSuper = me.role === "SUPER_ADMIN";
    const canDeleteUsers = me.role === "ADMIN" && hasPermission(me, "delete_users");
    const isManagerOfSchool = me.role === "MANAGER" && !!me.schoolId && user.schoolId === me.schoolId;
    const actingAdmin = me.role === "ADMIN" && !!actingCookie && actingCookie === user.schoolId && hasPermission(me, "enter_school_panel");
    // حذف کامل فقط برای سوپرادمین یا ادمینِ دارای delete_users؛ مدیر مدرسه فقط غیرفعال‌سازی (soft)
    if (mode !== "soft" && !isSuper && !canDeleteUsers) {
      return apiErr(403, "حذف کامل کاربر فقط برای ادمین سرویس ممکن است؛ مدیر مدرسه می‌تواند غیرفعال کند.", "FORBIDDEN");
    }
    if (!isSuper && !canDeleteUsers && !isManagerOfSchool && !actingAdmin) {
      return apiErr(403, "حذف این کاربر برای شما مجاز نیست.", "FORBIDDEN");
    }
    if ((user.role === "SUPER_ADMIN" || user.role === "ADMIN") && me.role !== "SUPER_ADMIN") {
      return apiErr(403, "حذف ادمین‌های سرویس فقط توسط مدیر کل سامانه ممکن است.", "FORBIDDEN");
    }

    if (mode === "soft") {
      await db.user.update({ where: { id }, data: { isActive: false } });
      await audit({
        user: me, action: "DEACTIVATE_USER", entityType: "USER", entityId: id,
        schoolId: user.schoolId,
      });
      return apiOk({ ok: true, mode: "soft" });
    }

    // ── حذف کامل از کل سامانه ──
    // اگر مدیر مدرسه است، مدرسه‌اش آزاد شود (داخل تراکنش — راند ۱۶)
    await (async () => {
      await db.school.updateMany({ where: { managerId: user.id }, data: { managerId: null } });

      // رکوردهای مستقیم
      await db.profileChangeRequest.deleteMany({ where: { OR: [{ userId: user.id }, { reviewedById: user.id }] } });
      await db.ticketMessage.deleteMany({ where: { senderId: user.id } });
      await db.blogPost.updateMany({ where: { authorId: user.id }, data: { authorId: null } });
      await db.shadSession.updateMany({ where: { authorizedBy: user.id }, data: { authorizedBy: null } });

      // FIX (راند ۱۶): روابط FK الزامی که قبلاً پاک نمی‌شدند → خطای ۵۰۰ قید کلید خارجی
      // جلسات (درخواست‌دهنده/کارمند)، رزروها، تیکت‌های تعمیر، مداخلات، گواهی‌ها، ایمپورت‌ها، چک‌این‌ها
      await db.meeting.deleteMany({ where: { OR: [{ requestedById: user.id }, { staffId: user.id }] } });
      await db.booking.deleteMany({ where: { byId: user.id } });
      await db.maintenanceTicket.deleteMany({ where: { reportedById: user.id } });
      await db.intervention.deleteMany({ where: { startedById: user.id } });
      await db.certificate.deleteMany({ where: { issuedById: user.id } });
      await db.importJob.deleteMany({ where: { userId: user.id } });
      // چک‌این‌های سلامت روان با مجوز این کاربر (خوداظهاری دانش‌آموز)
      await db.wellbeingCheckin.deleteMany({ where: { authorizedBy: user.id } });

      // دانش‌آموز؟ — پرونده + همه داده‌ها
      const student = await db.student.findUnique({ where: { userId: user.id } });
      if (student) {
        await db.attendance.deleteMany({ where: { studentId: student.id } });
        await db.gradeRecord.deleteMany({ where: { studentId: student.id } });
        await db.studentFee.deleteMany({ where: { studentId: student.id } });
        await db.studentParent.deleteMany({ where: { studentId: student.id } });
        await db.riskScore.deleteMany({ where: { studentId: student.id } });
        await db.wellbeingCheckin.deleteMany({ where: { studentId: student.id } });
        await db.student.delete({ where: { id: student.id } });
      }
      // ولی؟ — پیوندها
      await db.studentParent.deleteMany({ where: { parentUserId: user.id } });

      // کارمند؟ — واگذاری‌ها
      await db.teachingAssignment.deleteMany({ where: { teacherId: user.id } });
      await db.scheduleSlot.updateMany({ where: { teacherId: user.id }, data: { teacherId: null } });
      await db.class.updateMany({ where: { homeroomTeacherId: user.id }, data: { homeroomTeacherId: null } });
      await db.assignment.deleteMany({ where: { teacherId: user.id } });
      await db.attendance.updateMany({ where: { recordedById: user.id }, data: { recordedById: null } });
      await db.gradeRecord.updateMany({ where: { enteredById: user.id }, data: { enteredById: null } });
      await db.schoolEvent.updateMany({ where: { createdById: user.id }, data: { createdById: null } });
      await db.announcement.updateMany({ where: { createdById: user.id }, data: { createdById: null } });

      // پیام‌ها
      await db.message.deleteMany({ where: { OR: [{ senderId: user.id }, { recipientId: user.id }] } });

      // تیکت‌های خودش
      await db.ticket.deleteMany({ where: { userId: user.id } });

      // تیکت‌های اداره‌شده — پیام‌هایش بالا حذف شد؛ رکورد فعالیت بماند
      await db.auditLog.updateMany({ where: { userId: user.id }, data: { userId: null } });

      await db.user.delete({ where: { id: user.id } });
    })();

    await audit({
      user: me, action: "DELETE_USER", entityType: "USER", entityId: id,
      meta: { nationalId: user.nationalId, name: `${user.firstName} ${user.lastName}`, role: user.role },
      schoolId: user.schoolId,
    });

    return apiOk({ ok: true, mode: "hard" });
  } catch (e) {
    return handleApiError(e);
  }
}
