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
      const walletIds = (await db.studentWallet.findMany({ where: { schoolId: id }, select: { id: true } })).map((w) => w.id);
      const saleIds = (await db.shopSale.findMany({ where: { schoolId: id }, select: { id: true } })).map((s) => s.id);
      const sessionIds = (await db.examSession.findMany({ where: { schoolId: id }, select: { id: true } })).map((s) => s.id);
      const buildingIds = (await db.dormBuilding.findMany({ where: { schoolId: id }, select: { id: true } })).map((b) => b.id);
      const ops: any[] = [];

      // ۱) وابسته‌های نظرسنجی (FK به poll)
      if (pollIds.length) {
        ops.push(db.pollVote.deleteMany({ where: { pollId: { in: pollIds } } }));
        ops.push(db.pollOption.deleteMany({ where: { pollId: { in: pollIds } } }));
      }

      // ۲) جداول وابسته به دانش‌آموز
      if (studentIds.length) {
        ops.push(db.gradeHistory.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.studentBadge.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.studentDocument.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.studentGoal.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.intervention.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.portfolioItem.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.certificate.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.behaviorRecord.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.studentFee.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.studentParent.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.attendance.deleteMany({ where: { studentId: { in: studentIds } } }));
        ops.push(db.gradeRecord.deleteMany({ where: { studentId: { in: studentIds } } }));
      }

      // ۳) جداول وابسته به کلاس (باقی‌مانده از مرحله ۲)
      if (classIds.length) {
        ops.push(db.scheduleSlot.deleteMany({ where: { classId: { in: classIds } } }));
        ops.push(db.assignment.deleteMany({ where: { classId: { in: classIds } } }));
      }

      // ۴) جداول مدرسه‌محور (بدون user/ticket/auditLog — کاربران جدا می‌شوند، تیکت و گزارش فعالیت ماندنی‌اند)
      ops.push(db.teachingAssignment.deleteMany({ where: { schoolId: id } }));
      ops.push(db.scheduledReport.deleteMany({ where: { schoolId: id } }));
      ops.push(db.automationLog.deleteMany({ where: { schoolId: id } }));
      ops.push(db.automationRule.deleteMany({ where: { schoolId: id } }));
      ops.push(db.maintenanceTicket.deleteMany({ where: { schoolId: id } }));
      ops.push(db.booking.deleteMany({ where: { schoolId: id } }));
      ops.push(db.asset.deleteMany({ where: { schoolId: id } }));
      ops.push(db.room.deleteMany({ where: { schoolId: id } }));
      ops.push(db.lostFoundItem.deleteMany({ where: { schoolId: id } }));
      ops.push(db.visitorLog.deleteMany({ where: { schoolId: id } }));
      ops.push(db.importJob.deleteMany({ where: { schoolId: id } }));
      ops.push(db.certificateTemplate.deleteMany({ where: { schoolId: id } }));
      ops.push(db.suggestion.deleteMany({ where: { schoolId: id } }));
      ops.push(db.poll.deleteMany({ where: { schoolId: id } }));
      ops.push(db.house.deleteMany({ where: { schoolId: id } }));
      ops.push(db.customFieldDef.deleteMany({ where: { schoolId: id } }));
      ops.push(db.tagDef.deleteMany({ where: { schoolId: id } }));
      ops.push(db.task.deleteMany({ where: { schoolId: id } }));
      ops.push(db.leaveRequest.deleteMany({ where: { schoolId: id } }));
      ops.push(db.meeting.deleteMany({ where: { schoolId: id } }));
      ops.push(db.resourceLink.deleteMany({ where: { schoolId: id } }));
      ops.push(db.question.deleteMany({ where: { schoolId: id } }));
      ops.push(db.badge.deleteMany({ where: { schoolId: id } })); // نشان‌های سراسری (schoolId=null) دست‌نخورده می‌مانند
      ops.push(db.subject.deleteMany({ where: { schoolId: id } }));
      // FIX: مدل‌های با schoolId ساده و بدون رابطهٔ School که در آبشار قبلی جا مانده بودند —
      // پیش از حذف دانش‌آموزان/کلاس‌ها/مدرسه، تا ارجاع یتیم نماند
      if (walletIds.length) ops.push(db.walletTx.deleteMany({ where: { walletId: { in: walletIds } } }));
      ops.push(db.studentWallet.deleteMany({ where: { schoolId: id } }));
      if (saleIds.length) ops.push(db.shopSaleItem.deleteMany({ where: { saleId: { in: saleIds } } }));
      ops.push(db.shopSale.deleteMany({ where: { schoolId: id } }));
      ops.push(db.shopProduct.deleteMany({ where: { schoolId: id } }));
      if (sessionIds.length) {
        ops.push(db.examSeat.deleteMany({ where: { sessionId: { in: sessionIds } } }));
        ops.push(db.examInvigilator.deleteMany({ where: { sessionId: { in: sessionIds } } }));
      }
      ops.push(db.examSession.deleteMany({ where: { schoolId: id } }));
      ops.push(db.bookLoan.deleteMany({ where: { schoolId: id } }));
      ops.push(db.dormAssignment.deleteMany({ where: { schoolId: id } }));
      if (buildingIds.length) ops.push(db.dormRoom.deleteMany({ where: { buildingId: { in: buildingIds } } }));
      ops.push(db.dormBuilding.deleteMany({ where: { schoolId: id } }));
      ops.push(db.dormLeave.deleteMany({ where: { schoolId: id } }));
      ops.push(db.mealPlan.deleteMany({ where: { schoolId: id } }));
      ops.push(db.seatingPlan.deleteMany({ where: { schoolId: id } }));
      ops.push(db.transportBoarding.deleteMany({ where: { schoolId: id } }));
      ops.push(db.transportAssignment.deleteMany({ where: { schoolId: id } }));
      ops.push(db.student.deleteMany({ where: { schoolId: id } }));
      ops.push(db.class.deleteMany({ where: { schoolId: id } }));
      ops.push(db.schoolEvent.deleteMany({ where: { schoolId: id } }));
      ops.push(db.announcement.deleteMany({ where: { schoolId: id } })); // اعلان‌های سراسری (schoolId=null) می‌مانند
      ops.push(db.shadOutbox.deleteMany({ where: { schoolId: id } }));
      ops.push(db.shadSession.deleteMany({ where: { schoolId: id } }));
      ops.push(db.schoolSite.deleteMany({ where: { schoolId: id } }));
      ops.push(db.schoolLead.deleteMany({ where: { schoolId: id } }));

      // ۵) کاربران مدرسه: جدا شدن از مدرسه + غیرفعال شدن (حذف نمی‌شوند — تاریخچه و ارجاع‌های گزارش فعالیت سالم می‌مانند)
      if (schoolUserIds.length) {
        ops.push(db.user.updateMany({
          where: { id: { in: schoolUserIds } },
          data: { schoolId: null, isActive: false },
        }));
      }

      ops.push(db.school.delete({ where: { id } }));
      await db.$transaction(ops);
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
