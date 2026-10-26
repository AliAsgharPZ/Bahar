import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser } from "@/lib/api";
import { hasPermission } from "@/lib/roles";
import { isValidProvinceCounty } from "@/lib/iran";
import { planOf } from "@/lib/plans";
import { enDigits } from "@/lib/persian";

type Ctx = { params: Promise<{ id: string }> };

/** PATCH /api/schools/[id] — ویرایش کامل مدرسه (ادمین مجاز یا مدیر خود مدرسه برای متن‌ها/لوگو) */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const body = await readJson<Record<string, string | boolean | undefined>>(req);
    const school = await db.school.findUnique({ where: { id } });
    if (!school) return apiErr(404, "مدرسه یافت نشد.", "NOT_FOUND");

    const isSuper = me.role === "SUPER_ADMIN";
    const isAdminEditor = me.role === "ADMIN" && hasPermission(me, "edit_schools");
    const isOwnManager = me.role === "MANAGER" && me.schoolId === id;

    if (!isSuper && !isAdminEditor && !isOwnManager) {
      return apiErr(403, "ویرایش این مدرسه برای شما مجاز نیست.", "FORBIDDEN");
    }

    const data: Record<string, unknown> = {};
    const canFull = isSuper || isAdminEditor;

    if (canFull) {
      if (body.name !== undefined) data.name = String(body.name).trim();
      if (body.code !== undefined) data.code = String(body.code).trim();
      if (body.type !== undefined) data.type = String(body.type) || null;
      if (body.phone !== undefined) data.phone = enDigits(String(body.phone)).trim() || null;
      if (body.establishedYear !== undefined) {
        data.establishedYear = body.establishedYear ? Number(enDigits(String(body.establishedYear))) : null;
      }
      if (body.province !== undefined) data.province = String(body.province) || null;
      if (body.county !== undefined) {
        const county = String(body.county) || null;
        const province = (body.province !== undefined ? String(body.province) : school.province) ?? undefined;
        if (!isValidProvinceCounty(province, county ?? undefined)) {
          return apiErr(400, "این شهرستان به استان انتخابی تعلق ندارد.", "BAD_COUNTY");
        }
        data.county = county;
      }
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
      // اشتراک
      if (body.plan !== undefined) {
        const plan = String(body.plan);
        if (!["SILVER", "GOLD", "DIAMOND"].includes(plan)) {
          return apiErr(400, "پلن نامعتبر است.", "BAD_PLAN");
        }
        data.plan = plan;
      }
      if (body.planExpiresAt !== undefined) {
        if (body.planExpiresAt) {
          const d = new Date(String(body.planExpiresAt));
          if (isNaN(d.getTime())) return apiErr(400, "تاریخ انقضای اشتراک نامعتبر است.", "BAD_DATE");
          data.planExpiresAt = d;
        } else {
          data.planExpiresAt = null;
        }
      }
      if (body.planNote !== undefined) data.planNote = String(body.planNote) || null;
    }

    // مدیر مدرسه هم می‌تواند این‌ها را ویرایش کند
    if (body.address !== undefined) data.address = String(body.address) || null;
    if (body.city !== undefined) data.city = String(body.city) || null;
    if (body.motto !== undefined) data.motto = String(body.motto) || null;
    if (body.about !== undefined) data.about = String(body.about) || null;
    if (body.logoUrl !== undefined) data.logoUrl = String(body.logoUrl) || null;

    // راند ۱۸: ماژول‌های اختیاری مدرسه — شاد + نقش سرایدار (مدیر مدرسه/ادمین سرویس)
    if (body.shadEnabled !== undefined) data.shadEnabled = Boolean(body.shadEnabled);
    if (body.custodianEnabled !== undefined) data.custodianEnabled = Boolean(body.custodianEnabled);

    if (Object.keys(data).length === 0) return apiOk({ ok: true });

    await db.school.update({ where: { id }, data });
    await audit({
      user: me, action: "UPDATE_SCHOOL", entityType: "SCHOOL", entityId: id, schoolId: id,
      meta: { fields: Object.keys(data) },
    });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/schools/[id]?mode=soft|hard — غیرفعال‌سازی یا حذف کامل مدرسه */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const { id } = await ctx.params;
    const mode = new URL(req.url).searchParams.get("mode") ?? "soft";
    const school = await db.school.findUnique({ where: { id } });
    if (!school) return apiErr(404, "مدرسه یافت نشد.", "NOT_FOUND");

    const isSuper = me.role === "SUPER_ADMIN";
    const isAdmin = me.role === "ADMIN" && hasPermission(me, "delete_schools");
    if (!isSuper && !isAdmin) {
      return apiErr(403, "حذف مدرسه برای شما مجاز نیست.", "FORBIDDEN");
    }

    if (mode === "soft") {
      await db.school.update({ where: { id }, data: { isActive: false } });
      await audit({ user: me, action: "DEACTIVATE_SCHOOL", entityType: "SCHOOL", entityId: id, schoolId: id });
      return apiOk({ ok: true, mode: "soft" });
    }

    // ── حذف کامل مدرسه + همه داده‌هایش ──
    // فهرست جداول از schema.prisma تولید شده (scripts/gen-school-cascade.mjs) —
    // هر مدلِ دارای ستون schoolId/studentId/classId اینجا پوشش داده شده است.
    const cascaded = await db.$transaction(async (tx) => {
      // شناسه‌های پایه
      const students = await tx.student.findMany({ where: { schoolId: id }, select: { id: true } });
      const studentIds = students.map((s) => s.id);
      const classes = await tx.class.findMany({ where: { schoolId: id }, select: { id: true } });
      const classIds = classes.map((c) => c.id);
      const polls = await tx.poll.findMany({ where: { schoolId: id }, select: { id: true } });
      const pollIds = polls.map((p) => p.id);
      const schoolUsers = await tx.user.findMany({
        where: { schoolId: id, role: { in: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"] } },
        select: { id: true },
      });
      const schoolUserIds = schoolUsers.map((u) => u.id);

      // ۱) وابسته‌های نظرسنجی (FK به poll)
      if (pollIds.length) {
        await tx.pollVote.deleteMany({ where: { pollId: { in: pollIds } } });
        await tx.pollOption.deleteMany({ where: { pollId: { in: pollIds } } });
      }

      // ۲) جداول وابسته به دانش‌آموز
      if (studentIds.length) {
        await tx.gradeHistory.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentBadge.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentDocument.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentGoal.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.intervention.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.portfolioItem.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.certificate.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.behaviorRecord.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentFee.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.studentParent.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
        await tx.gradeRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      }

      // ۳) جداول وابسته به کلاس (باقی‌مانده از مرحله ۲)
      if (classIds.length) {
        await tx.scheduleSlot.deleteMany({ where: { classId: { in: classIds } } });
        await tx.assignment.deleteMany({ where: { classId: { in: classIds } } });
      }

      // ۴) جداول مدرسه‌محور (بدون user/ticket/auditLog — کاربران جدا می‌شوند، تیکت و گزارش فعالیت ماندنی‌اند)
      await tx.teachingAssignment.deleteMany({ where: { schoolId: id } });
      await tx.scheduledReport.deleteMany({ where: { schoolId: id } });
      await tx.automationLog.deleteMany({ where: { schoolId: id } });
      await tx.automationRule.deleteMany({ where: { schoolId: id } });
      await tx.maintenanceTicket.deleteMany({ where: { schoolId: id } });
      await tx.booking.deleteMany({ where: { schoolId: id } });
      await tx.asset.deleteMany({ where: { schoolId: id } });
      await tx.room.deleteMany({ where: { schoolId: id } });
      await tx.lostFoundItem.deleteMany({ where: { schoolId: id } });
      await tx.visitorLog.deleteMany({ where: { schoolId: id } });
      await tx.importJob.deleteMany({ where: { schoolId: id } });
      await tx.certificateTemplate.deleteMany({ where: { schoolId: id } });
      await tx.suggestion.deleteMany({ where: { schoolId: id } });
      await tx.poll.deleteMany({ where: { schoolId: id } });
      await tx.house.deleteMany({ where: { schoolId: id } });
      await tx.customFieldDef.deleteMany({ where: { schoolId: id } });
      await tx.tagDef.deleteMany({ where: { schoolId: id } });
      await tx.task.deleteMany({ where: { schoolId: id } });
      await tx.leaveRequest.deleteMany({ where: { schoolId: id } });
      await tx.meeting.deleteMany({ where: { schoolId: id } });
      await tx.resourceLink.deleteMany({ where: { schoolId: id } });
      await tx.question.deleteMany({ where: { schoolId: id } });
      await tx.badge.deleteMany({ where: { schoolId: id } }); // نشان‌های سراسری (schoolId=null) دست‌نخورده می‌مانند
      await tx.subject.deleteMany({ where: { schoolId: id } });
      await tx.student.deleteMany({ where: { schoolId: id } });
      await tx.class.deleteMany({ where: { schoolId: id } });
      await tx.schoolEvent.deleteMany({ where: { schoolId: id } });
      await tx.announcement.deleteMany({ where: { schoolId: id } }); // اعلان‌های سراسری (schoolId=null) می‌مانند
      await tx.shadOutbox.deleteMany({ where: { schoolId: id } });
      await tx.shadSession.deleteMany({ where: { schoolId: id } });
      await tx.schoolSite.deleteMany({ where: { schoolId: id } });
      await tx.schoolLead.deleteMany({ where: { schoolId: id } });

      // ۵) کاربران مدرسه: جدا شدن از مدرسه + غیرفعال شدن (حذف نمی‌شوند — تاریخچه و ارجاع‌های گزارش فعالیت سالم می‌مانند)
      if (schoolUserIds.length) {
        await tx.user.updateMany({
          where: { id: { in: schoolUserIds } },
          data: { schoolId: null, isActive: false },
        });
      }

      await tx.school.delete({ where: { id } });
      return { students: studentIds.length, classes: classIds.length, usersDeactivated: schoolUserIds.length };
    });

    await audit({
      user: me, action: "DELETE_SCHOOL", entityType: "SCHOOL", entityId: id,
      meta: { name: school.name, code: school.code, plan: planOf(school.plan), cascaded },
    });
    return apiOk({ ok: true, mode: "hard", cascaded });
  } catch (e) {
    return handleApiError(e);
  }
}
