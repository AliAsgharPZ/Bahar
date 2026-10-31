import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor, demoWriteBlock} from "@/lib/api";
import { getSettings, saveSettings } from "@/lib/settings";
import { signToken, sessionCookie } from "@/lib/auth";
import { PERMISSION_CATALOG, ROLE_LABELS, hasPermission } from "@/lib/roles";

/* ============================================================
   بهار | مرکز کنترل ادمین — سلامت، فلگ، تعمیرات، لاگین‌ها،
   مشاهده‌جانشینی، خروج اجباری نشست‌ها
   ============================================================ */

/** GET /api/admin?view=health|logins|sessions|matrix */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN", "ADMIN"]);
    const view = new URL(req.url).searchParams.get("view") ?? "health";

    if (view === "health") {
      const actingSchoolId = actingSchoolIdFor(req, me);
      const schoolId = actingSchoolId ?? me.schoolId;
      const [dbOk, recentErrors, lastBackup, failedOutbox, openTickets] = await Promise.all([
        db.$queryRaw`SELECT 1 as ok`.then(() => true).catch(() => false),
        db.auditLog.findMany({ where: { action: { contains: "خطا" } }, orderBy: { createdAt: "desc" }, take: 10 }),
        db.backup.findFirst({ orderBy: { createdAt: "desc" } }),
        db.shadOutbox.count({ where: { status: "FAILED" } }),
        db.ticket.count({ where: { status: "OPEN" } }),
      ]);

      // سلامت راه‌اندازی مدرسه
      let setupHealth: Array<{ issue: string; detail: string; severity: "HIGH" | "NORMAL" }> = [];
      if (schoolId) {
        const [classesNoTeacher, subjectsNoAssign, studentsNoClass, usersNoPhone] = await Promise.all([
          db.class.count({ where: { schoolId, isActive: true, homeroomTeacherId: null } }),
          db.subject.count({ where: { schoolId, teachingAssignments: { none: {} } } }),
          db.student.count({ where: { schoolId, classId: null } }),
          db.user.count({ where: { schoolId, phone: null, role: { in: ["TEACHER", "PARENT"] } } }),
        ]);
        if (classesNoTeacher > 0) setupHealth.push({ issue: "کلاس بدون معلم راهنما", detail: `${classesNoTeacher} کلاس`, severity: "NORMAL" });
        if (subjectsNoAssign > 0) setupHealth.push({ issue: "درس بدون تخصیص معلم", detail: `${subjectsNoAssign} درس`, severity: "HIGH" });
        if (studentsNoClass > 0) setupHealth.push({ issue: "دانش‌آموز بدون کلاس", detail: `${studentsNoClass} نفر`, severity: "HIGH" });
        if (usersNoPhone > 0) setupHealth.push({ issue: "کاربر بدون شماره تماس", detail: `${usersNoPhone} کاربر`, severity: "NORMAL" });
      }

      // کیفیت داده
      let dataQuality: Array<{ issue: string; count: number }> = [];
      if (schoolId) {
        const [noBirth] = await Promise.all([
          db.student.count({ where: { schoolId, user: { birthDate: null } } }),
        ]);
        if (noBirth > 0) dataQuality.push({ issue: "دانش‌آموز بدون تاریخ تولد", count: noBirth });
        const feeNoDue = await db.studentFee.count({ where: { schoolId, dueDate: null, status: "UNPAID" } });
        if (feeNoDue > 0) dataQuality.push({ issue: "قسط بدون سررسید", count: feeNoDue });
      }

      const settings = await getSettings();
      return apiOk({
        view,
        services: [
          { name: "پایگاه داده", status: dbOk ? "UP" : "DOWN" },
          { name: "پیامرسان شاد", status: failedOutbox > 5 ? "DEGRADED" : "UP", note: `${failedOutbox} پیام ناموفق` },
          { name: "پشتیبانی", status: openTickets > 10 ? "BUSY" : "UP", note: `${openTickets} تیکت باز` },
          { name: "بکاپ", status: lastBackup ? (Date.now() - lastBackup.createdAt.getTime() > settings.autoBackupDays * 86400000 ? "STALE" : "UP") : "NONE", note: lastBackup?.createdAt ?? null },
        ],
        lastBackup: lastBackup ? { at: lastBackup.createdAt, filename: lastBackup.filename, recordCount: lastBackup.recordCount } : null,
        setupHealth, dataQuality, recentErrors,
      });
    }

    if (view === "logins") {
      // لاگین‌های کاربران فقط با دسترسی view_users
      if (me.role === "ADMIN" && !hasPermission(me, "view_users")) {
        return apiErr(403, "مشاهده تاریخچه ورود کاربران نیاز به دسترسی «مشاهده کاربران» دارد.", "FORBIDDEN");
      }
      const target = new URL(req.url).searchParams.get("userId");
      // ادمین سرویس فقط لاگین‌های مدرسه‌ای را می‌بیند که وارد پنلش شده است
      const acting = me.role === "ADMIN" ? actingSchoolIdFor(req, me) : null;
      const logins = await db.loginEvent.findMany({
        where: {
          ...(target ? { userId: target } : {}),
          ...(acting ? { user: { schoolId: acting } } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { user: { select: { firstName: true, lastName: true, nationalId: true, role: true } } },
      });
      return apiOk({ view, logins });
    }

    if (view === "sessions") {
      // نشست‌های فعال فقط با دسترسی view_users
      if (me.role === "ADMIN" && !hasPermission(me, "view_users")) {
        return apiErr(403, "مشاهده نشست‌های کاربران نیاز به دسترسی «مشاهده کاربران» دارد.", "FORBIDDEN");
      }
      // نشست‌های فعال = ورودهای موفق ۱۴ روز اخیر (عمر توکن)
      const since = new Date(Date.now() - 14 * 86400000);
      const actingSessions = me.role === "ADMIN" ? actingSchoolIdFor(req, me) : null;
      const sessions = await db.loginEvent.findMany({
        where: { status: "SUCCESS", createdAt: { gte: since }, ...(actingSessions ? { user: { schoolId: actingSessions } } : {}) },
        orderBy: { createdAt: "desc" },
        take: 200,
        include: { user: { select: { id: true, firstName: true, lastName: true, role: true, nationalId: true, schoolId: true } } },
      });
      // گروه‌بندی بر اساس کاربر + آخرین ورود
      const byUser = new Map<string, { user: { id: string; name: string; role: string; nationalId: string }; lastAt: Date; devices: number; ips: number }>();
      for (const s of sessions) {
        if (!s.user) continue;
        const cur = byUser.get(s.user.id) ?? { user: { id: s.user.id, name: `${s.user.firstName} ${s.user.lastName}`, role: s.user.role, nationalId: s.user.nationalId }, lastAt: s.createdAt, devices: 0, ips: 0 };
        cur.lastAt = s.createdAt > cur.lastAt ? s.createdAt : cur.lastAt;
        cur.devices++;
        byUser.set(s.user.id, cur);
      }
      return apiOk({ view, sessions: [...byUser.values()] });
    }

    if (view === "matrix") {
      return apiOk({ view, roles: ROLE_LABELS, permissions: PERMISSION_CATALOG });
    }

    return apiErr(400, "نمای نامعتبر.", "BAD_VIEW");
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/admin — عملیات مدیریتی حساس */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    /* ── خروج اجباری همه نشست‌های یک کاربر (افزایش tokenVersion) ── */
    if (action === "force-logout") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const userId = String(body.userId ?? "");
      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
      if (target.role === "SUPER_ADMIN" && target.id !== me.id) {
        return apiErr(403, "خروج اجباری سوپرادمین دیگر مجاز نیست.", "FORBIDDEN");
      }
      await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      await audit({ user: me, action: "خروج اجباری همه نشست‌ها", entityType: "USER", entityId: userId });
      return apiOk({ ok: true });
    }

    /* ── ابطال نشست جانشینی یک کاربر: توکن جانشینی tv کاربر هدف را حمل می‌کند، پس افزایش tokenVersion آن را فوراً می‌کشد ── */
    if (action === "impersonate-revoke") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const userId = String(body.userId ?? "");
      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
      await db.user.update({ where: { id: userId }, data: { tokenVersion: { increment: 1 } } });
      await audit({ user: me, action: "ابطال نشست جانشینی", entityType: "USER", entityId: userId });
      return apiOk({ ok: true });
    }

    /* ── مشاهده‌جانشینی امن: فقط سوپرادمین، فقط-خواندنی ── */
    if (action === "impersonate") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const userId = String(body.userId ?? "");
      const target = await db.user.findUnique({ where: { id: userId } });
      if (!target || !target.isActive) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
      if (target.role === "SUPER_ADMIN") return apiErr(403, "جانشینی روی سوپرادمین مجاز نیست.", "FORBIDDEN");
      const token = signToken({ sub: target.id, role: target.role, tv: target.tokenVersion, imp: me.id });
      await audit({ user: me, action: "شروع مشاهده‌جانشینی", entityType: "USER", entityId: target.id, meta: { target: `${target.firstName} ${target.lastName}` } });
      const res = NextResponse.json({ ok: true, user: { id: target.id, role: target.role, firstName: target.firstName, lastName: target.lastName, schoolId: target.schoolId } });
      res.headers.append("Set-Cookie", sessionCookie(token));
      return res;
    }

    /* ── پایان مشاهده‌جانشینی: بازگشت به سوپرادمین ── */
    if (action === "impersonate-exit") {
      if (!me.impersonatedBy) return apiErr(400, "در حالت جانشینی نیستید.", "NOT_IMPERSONATING");
      const admin = await db.user.findUnique({ where: { id: me.impersonatedBy } });
      if (!admin || admin.role !== "SUPER_ADMIN") return apiErr(403, "سوپرادمین جانشین یافت نشد.", "FORBIDDEN");
      await audit({ user: { ...me, id: admin.id, role: admin.role } as typeof me, action: "پایان مشاهده‌جانشینی", entityType: "USER", entityId: me.id });
      const token = signToken({ sub: admin.id, role: admin.role, tv: admin.tokenVersion });
      const res = NextResponse.json({ ok: true });
      res.headers.append("Set-Cookie", sessionCookie(token));
      return res;
    }

    /* ── حالت تعمیراتی ── */
    if (action === "maintenance") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const enabled = body.enabled === true;
      await saveSettings({ maintenanceMode: enabled, maintenanceMessage: String(body.message ?? "سامانه در حال به‌روزرسانی است؛ به‌زودی برمی‌گردیم.") });
      await audit({ user: me, action: enabled ? "فعال‌سازی حالت تعمیراتی" : "غیرفعال‌سازی حالت تعمیراتی" });
      return apiOk({ ok: true, maintenanceMode: enabled });
    }

    /* ── فلگ قابلیت ── */
    if (action === "feature-flag") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const key = String(body.key ?? "");
      const enabled = body.enabled === true;
      if (!key) return apiErr(400, "کلید لازم است.", "BAD_REQUEST");
      const s = await getSettings();
      const flags = { ...s.featureFlags, [key]: enabled };
      await saveSettings({ featureFlags: flags });
      await audit({ user: me, action: "تغییر فلگ قابلیت", meta: { key, enabled } });
      return apiOk({ flags });
    }

    /* ── قفل مدرسه ── */
    if (action === "lock-school") {
      if (me.role !== "SUPER_ADMIN") return apiErr(403, "فقط سوپرادمین.", "FORBIDDEN");
      const schoolId = String(body.schoolId ?? "");
      const locked = body.locked === true;
      await db.school.update({ where: { id: schoolId }, data: { isActive: !locked } });
      await audit({ user: me, action: locked ? "قفل مدرسه" : "بازگشایی مدرسه", entityType: "SCHOOL", entityId: schoolId });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
