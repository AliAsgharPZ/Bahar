import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, isDemoUser } from "@/lib/api";
import { hasPermission } from "@/lib/roles";
import { isValidProvinceCounty } from "@/lib/iran";
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
    const cascaded = await (async () => {
      // شناسه‌های پایه
      const students = await db.student.findMany({ where: { schoolId: id }, select: { id: true } });
      const studentIds = students.map((s) => s.id);
      const classes = await db.class.findMany({ where: { schoolId: id }, select: { id: true } });
      const classIds = classes.map((c) => c.id);
      const polls = await db.poll.findMany({ where: { schoolId: id }, select: { id: true } });
      const pollIds = polls.map((p) => p.id);
      const schoolUsers = await db.user.findMany({
        where: { schoolId: id, role: { in: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"] } },
        select: { id: true },
      });
      const schoolUserIds = schoolUsers.map((u) => u.id);

      // ۱) وابسته‌های نظرسنجی (FK به poll)
      if (pollIds.length) {
        await db.pollVote.deleteMany({ where: { pollId: { in: pollIds } } });
        await db.pollOption.deleteMany({ where: { pollId: { in: pollIds } } });
      }

      // ۲) جداول وابسته به دانش‌آموز
      if (studentIds.length) {
        await db.gradeHistory.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.studentBadge.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.studentDocument.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.studentGoal.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.intervention.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.portfolioItem.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.certificate.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.behaviorRecord.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.studentFee.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.studentParent.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.attendance.deleteMany({ where: { studentId: { in: studentIds } } });
        await db.gradeRecord.deleteMany({ where: { studentId: { in: studentIds } } });
      }

      // ۳) جداول وابسته به کلاس (باقی‌مانده از مرحله ۲)
      if (classIds.length) {
        await db.scheduleSlot.deleteMany({ where: { classId: { in: classIds } } });
        await db.assignment.deleteMany({ where: { classId: { in: classIds } } });
      }

      // ۴) جداول مدرسه‌محور (بدون user/ticket/auditLog — کاربران جدا می‌شوند، تیکت و گزارش فعالیت ماندنی‌اند)
      await db.teachingAssignment.deleteMany({ where: { schoolId: id } });
      await db.scheduledReport.deleteMany({ where: { schoolId: id } });
      await db.automationLog.deleteMany({ where: { schoolId: id } });
      await db.automationRule.deleteMany({ where: { schoolId: id } });
      await db.maintenanceTicket.deleteMany({ where: { schoolId: id } });
      await db.booking.deleteMany({ where: { schoolId: id } });
      await db.asset.deleteMany({ where: { schoolId: id } });
      await db.room.deleteMany({ where: { schoolId: id } });
      await db.lostFoundItem.deleteMany({ where: { schoolId: id } });
      await db.visitorLog.deleteMany({ where: { schoolId: id } });
      await db.importJob.deleteMany({ where: { schoolId: id } });
      await db.certificateTemplate.deleteMany({ where: { schoolId: id } });
      await db.suggestion.deleteMany({ where: { schoolId: id } });
      await db.poll.deleteMany({ where: { schoolId: id } });
      await db.house.deleteMany({ where: { schoolId: id } });
      await db.customFieldDef.deleteMany({ where: { schoolId: id } });
      await db.tagDef.deleteMany({ where: { schoolId: id } });
      await db.task.deleteMany({ where: { schoolId: id } });
      await db.leaveRequest.deleteMany({ where: { schoolId: id } });
      await db.meeting.deleteMany({ where: { schoolId: id } });
      await db.resourceLink.deleteMany({ where: { schoolId: id } });
      await db.question.deleteMany({ where: { schoolId: id } });
      await db.badge.deleteMany({ where: { schoolId: id } }); // نشان‌های سراسری (schoolId=null) دست‌نخورده می‌مانند
      await db.subject.deleteMany({ where: { schoolId: id } });
      await db.student.deleteMany({ where: { schoolId: id } });
      await db.class.deleteMany({ where: { schoolId: id } });
      await db.schoolEvent.deleteMany({ where: { schoolId: id } });
      await db.announcement.deleteMany({ where: { schoolId: id } }); // اعلان‌های سراسری (schoolId=null) می‌مانند
      await db.shadOutbox.deleteMany({ where: { schoolId: id } });
      await db.shadSession.deleteMany({ where: { schoolId: id } });
      await db.schoolSite.deleteMany({ where: { schoolId: id } });
      await db.schoolLead.deleteMany({ where: { schoolId: id } });

      // ۵) کاربران مدرسه: جدا شدن از مدرسه + غیرفعال شدن (حذف نمی‌شوند — تاریخچه و ارجاع‌های گزارش فعالیت سالم می‌مانند)
      if (schoolUserIds.length) {
        await db.user.updateMany({
          where: { id: { in: schoolUserIds } },
          data: { schoolId: null, isActive: false },
        });
      }

      await db.school.delete({ where: { id } });
      return { students: studentIds.length, classes: classIds.length, usersDeactivated: schoolUserIds.length };
    })();

    await audit({
      user: me, action: "DELETE_SCHOOL", entityType: "SCHOOL", entityId: id,
      meta: { name: school.name, code: school.code, cascaded },
    });
    return apiOk({ ok: true, mode: "hard", cascaded });
  } catch (e) {
    return handleApiError(e);
  }
}
