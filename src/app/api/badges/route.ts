import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

/** GET /api/badges — بج‌های مدرسه + بج‌های کاربر (دانش‌آموز) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    let targetStudentId = studentId;

    if (me.role === "STUDENT") {
      const s = await db.student.findFirst({ where: { userId: me.id } });
      if (studentId && s && studentId !== s.id) {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
      targetStudentId = studentId ?? s?.id ?? null;
    } else if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const kidIds = kids.map((k) => k.studentId);
      if (studentId && !kidIds.includes(studentId)) {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
      if (!targetStudentId) targetStudentId = kidIds[0] ?? null;
    } else if (studentId && me.role !== "SUPER_ADMIN" && me.role !== "ADMIN") {
      // کارکنان: فقط دانش‌آموزان همان مدرسه
      const target = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
      if (!target) return apiOk({ badges: [], earned: [], studentId: null, totalPoints: 0 });
      if (target.schoolId !== me.schoolId) return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
    }

    const schoolFilter = me.schoolId
      ? { OR: [{ schoolId: me.schoolId }, { schoolId: null }] }
      : { schoolId: null };

    const [badges, earned] = await Promise.all([
      db.badge.findMany({
        where: { ...schoolFilter, active: true },
        orderBy: [{ tier: "desc" }, { points: "desc" }],
      }),
      targetStudentId
        ? db.studentBadge.findMany({
            where: { studentId: targetStudentId },
            include: { badge: true },
            orderBy: { awardedAt: "desc" },
          })
        : Promise.resolve([]),
    ]);
    return apiOk({
      badges,
      earned,
      studentId: targetStudentId,
      totalPoints: earned.reduce((s, b) => s + b.badge.points, 0),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/badges — اعطای بج به دانش‌آموز (مدیر/معاون/معلم) یا تعریف بج جدید */
export async function POST(req: NextRequest) {
  try {
    // توجه: اکشن feature برای خود دانش‌آموز هم مجاز است — کنترل ریز در هر شاخه
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      action: "award" | "define" | "feature";
      studentId?: string;
      badgeId?: string;
      isFeatured?: boolean;
      badge?: { key: string; title: string; description: string; icon: string; tier: string; points: number; effectKind: string; effectValue?: string };
    }>(req);

    if (body.action === "feature" && body.studentId && body.badgeId) {
      // دانش‌آموز خودش یا کارکنان همان مدرسه می‌توانند بج ویژه را انتخاب کنند
      const target = await db.student.findUnique({ where: { id: body.studentId }, select: { schoolId: true, userId: true } });
      if (!target) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const isSelf = target.userId === me.id;
      const isStaffOfSchool =
        ["MANAGER", "DEPUTY", "TEACHER"].includes(me.role) && me.schoolId === target.schoolId;
      const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
      if (!isSelf && !isStaffOfSchool && !isService) {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
      const hasBadge = await db.studentBadge.findUnique({
        where: { studentId_badgeId: { studentId: body.studentId, badgeId: body.badgeId } },
      });
      if (!hasBadge) return apiErr(404, "این بج به دانش‌آموز داده نشده است.", "NOT_EARNED");
      await db.studentBadge.updateMany({
        where: { studentId: body.studentId },
        data: { isFeatured: false },
      });
      const sb = await db.studentBadge.update({
        where: { studentId_badgeId: { studentId: body.studentId, badgeId: body.badgeId } },
        data: { isFeatured: true },
      });
      await audit({ user: me, action: "FEATURE_BADGE", entityType: "StudentBadge", entityId: sb.id, meta: { studentId: body.studentId, badgeId: body.badgeId } });
      return apiOk({ studentBadge: sb });
    }

    // ── سایر اکشن‌ها فقط برای کارکنان/سرویس ──
    if (!["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(me.role)) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }

    if (body.action === "define") {
      // FIX (راند ۱۸): تعریف بج فقط توسط سوپرادمین — مدیر مدرسه فقط اهدا می‌کند
      if (me.role !== "SUPER_ADMIN") {
        return apiErr(403, "تعریف بج فقط توسط مدیر کل سامانه انجام می‌شود؛ مدیر مدرسه بج‌های تعریف‌شده را به دانش‌آموزان اهدا می‌کند.", "FORBIDDEN");
      }
      if (!body.badge?.key || !body.badge.title) return apiErr(400, "کلید و عنوان بج لازم است.", "BAD_REQUEST");
      // بج سراسری (schoolId=null) یا بج همان مدرسه‌ای که سوپرادمین وارد پنلش شده است
      const badgeSchoolId = actingSchoolIdFor(req, me);
      const key = String(body.badge.key).trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
      if (!key) return apiErr(400, "کلید بج باید حروف لاتین باشد.", "BAD_KEY");
      const dupe = await db.badge.findFirst({ where: { key, schoolId: badgeSchoolId } });
      if (dupe) return apiErr(409, "بج با این کلید قبلاً تعریف شده است.", "DUPLICATE");
      const badge = await db.badge.create({
        data: {
          schoolId: badgeSchoolId,
          key,
          title: body.badge.title,
          description: body.badge.description ?? "",
          icon: body.badge.icon ?? "Award",
          tier: body.badge.tier ?? "BRONZE",
          points: body.badge.points ?? 10,
          effectKind: body.badge.effectKind ?? "NONE",
          effectValue: body.badge.effectValue ?? null,
        },
      });
      await audit({ user: me, action: "تعریف بج جدید", entityType: "Badge", entityId: badge.id, meta: { title: badge.title, schoolId: badgeSchoolId } });
      return apiOk({ badge });
    }

    // action === "feature" قبل از این نقطه رسیدگی شده است

    // award
    if (!body.studentId || !body.badgeId) return apiErr(400, "شناسه دانش‌آموز و بج لازم است.", "BAD_REQUEST");
    const [student, badge] = await Promise.all([
      db.student.findUnique({ where: { id: body.studentId } }),
      db.badge.findUnique({ where: { id: body.badgeId } }),
    ]);
    if (!student || !badge) return apiErr(404, "دانش‌آموز یا بج یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && student.schoolId !== me.schoolId) {
      return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
    }
    // بج باید تعریفِ همین مدرسه (یا عمومی سرویس) باشد — ارجاع بین‌مدرسه‌ای ممنوع
    if (badge.schoolId !== null && badge.schoolId !== student.schoolId && me.role !== "SUPER_ADMIN") {
      return apiErr(403, "این بج متعلق به مدرسه شما نیست.", "FORBIDDEN");
    }
    const existing = await db.studentBadge.findUnique({
      where: { studentId_badgeId: { studentId: student.id, badgeId: badge.id } },
    });
    if (existing) return apiErr(409, "این بج قبلاً به این دانش‌آموز داده شده است.", "ALREADY_EARNED");
    const sb = await db.studentBadge.create({
      data: { studentId: student.id, badgeId: badge.id, awardedById: me.id },
    });
    await notifyUser(
      student.userId,
      "SUCCESS",
      `بج «${badge.title}» گرفتی!`,
      badge.description,
      `/app/badges`,
      "BADGE"
    );
    await audit({ user: me, action: "اعطای بج", entityType: "StudentBadge", entityId: sb.id, meta: { badge: badge.title, studentId: student.id } });
    return apiOk({ studentBadge: sb });
  } catch (e) {
    return handleApiError(e);
  }
}
