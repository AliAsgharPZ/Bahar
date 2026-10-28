import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";
import { PERMISSION_CATALOG, hasPermission } from "@/lib/roles";

/* ============================================================
   بهار | آزمایشگاه‌ها — ابزارهای تمایز روی دادهٔ واقعی
   هیچ‌کدام دادهٔ واقعی را تغییر نمی‌دهند (فقط خواندن + محاسبه):
   - simulation: سناریوی «اگر…» روی حضور/نمرهٔ یک کلاس
   - history: بازپخش رخدادهای یک موجودیت از AuditLog
   - permissions: زمین‌بازی مجوز — ارزیابی خشک نقش/مجوزها
   - quality: اسکن کیفیت داده (رکوردهای ناقص/تکراری/خارج از بازه)
   - dependency: گراف وابستگی یک کلاس/درس/دانش‌آموز
   - forecast: پیش‌بینی ظرفیت — حسابی ساده بر پایهٔ رشد سناریویی،
     نه مدل یادگیری ماشین؛ برچسب «سناریو» روی خروجی هست.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const q = new URL(req.url).searchParams;
    const tool = q.get("tool") ?? "";

    if (tool === "simulation") {
      const classId = q.get("classId") ?? "";
      const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true, capacity: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
      const [students, attendance, grades] = await Promise.all([
        db.student.count({ where: { classId, status: "ACTIVE" } }),
        db.attendance.findMany({ where: { classId } }),
        db.gradeRecord.findMany({ where: { classId } }),
      ]);
      const present = attendance.filter((a) => a.status === "PRESENT").length;
      const rate = attendance.length ? Math.round((present / attendance.length) * 100) : 0;
      const avg = grades.length ? Math.round((grades.reduce((s, g) => s + g.score, 0) / grades.length) * 100) / 100 : 0;
      const absenceDelta = Math.min(50, Math.max(0, Math.round(Number(q.get("absenceDelta") ?? 10) || 10)));
      // سناریوی ساده و شفاف: هر ۱۰ واحد افزایش غیبت، میانگین را ~۰٫۵ نمره پایین می‌آورد (فرض آزمایشگاه، نه پیش‌بینی قطعی).
      const projectedAvg = Math.max(0, Math.round((avg - (absenceDelta / 10) * 0.5) * 100) / 100);
      return apiOk({ tool, class: cls.name, students, attendanceRows: attendance.length, attendanceRate: rate, gradeAvg: avg, scenario: { absenceDelta, projectedAttendanceRate: Math.max(0, rate - absenceDelta), projectedGradeAvg: projectedAvg }, note: "سناریوی حسابی ساده است، نه پیش‌بینی قطعی." });
    }

    if (tool === "history") {
      const entityType = q.get("entityType") ?? "";
      const entityId = q.get("entityId") ?? "";
      if (!entityType || !entityId) return apiErr(400, "entityType و entityId لازم است.", "BAD_INPUT");
      const rows = await db.auditLog.findMany({ where: { schoolId, entityType, entityId }, orderBy: { createdAt: "asc" }, take: 200 });
      return apiOk({ tool, count: rows.length, events: rows });
    }

    if (tool === "quality") {
      const [noClass, noTeacherClass, outOfRange, emptyRooms, dupNational] = await Promise.all([
        db.student.findMany({ where: { schoolId, classId: null, status: "ACTIVE" }, include: { user: { select: { firstName: true, lastName: true } } }, take: 5 }),
        db.class.findMany({ where: { schoolId, homeroomTeacherId: null, isActive: true }, take: 5 }),
        db.gradeRecord.findMany({ where: { class: { schoolId }, OR: [{ score: { lt: 0 } }, { score: { gt: 20 } }] }, take: 5 }),
        db.dormRoom.findMany({ where: { building: { schoolId }, capacity: { lte: 0 } }, take: 5 }),
        db.user.groupBy({ by: ["nationalId"], where: { schoolId }, _count: { _all: true }, having: { nationalId: { _count: { gt: 1 } } }, take: 5 }),
      ]);
      const checks = [
        { key: "students_without_class", label: "دانش‌آموز فعال بدون کلاس", count: noClass.length, sample: noClass.map((s) => `${s.user.firstName} ${s.user.lastName}`) },
        { key: "classes_without_homeroom", label: "کلاس فعال بدون معلم راهنما", count: noTeacherClass.length, sample: noTeacherClass.map((c) => c.name) },
        { key: "grades_out_of_range", label: "نمره خارج از بازهٔ ۰ تا ۲۰", count: outOfRange.length, sample: outOfRange.map((g) => g.id) },
        { key: "rooms_zero_capacity", label: "اتاق خوابگاه با ظرفیت صفر", count: emptyRooms.length, sample: emptyRooms.map((r) => r.name) },
        { key: "duplicate_national_ids", label: "کد ملی تکراری در مدرسه", count: dupNational.length, sample: dupNational.map((d) => d.nationalId) },
      ];
      return apiOk({ tool, checks, note: "نمونه‌ها حداکثر ۵ مورد اول هر بررسی‌اند؛ شمارش کامل نیست." });
    }

    if (tool === "dependency") {
      const kind = q.get("kind") ?? "class";
      const id = q.get("id") ?? "";
      if (!id) return apiErr(400, "id لازم است.", "BAD_INPUT");
      if (kind === "class") {
        const cls = await db.class.findFirst({ where: { id, schoolId }, select: { id: true, name: true } });
        if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
        const [students, attendance, grades, assignments, schedule] = await Promise.all([
          db.student.count({ where: { classId: id } }),
          db.attendance.count({ where: { classId: id } }),
          db.gradeRecord.count({ where: { classId: id } }),
          db.teachingAssignment.count({ where: { classId: id } }),
          db.scheduleSlot.count({ where: { classId: id } }),
        ]);
        return apiOk({ tool, node: { kind, id, name: cls.name }, edges: [
          { to: "students", count: students }, { to: "attendance", count: attendance }, { to: "grades", count: grades },
          { to: "teachingAssignments", count: assignments }, { to: "scheduleSlots", count: schedule },
        ] });
      }
      if (kind === "student") {
        const st = await db.student.findFirst({ where: { id, schoolId }, include: { user: { select: { firstName: true, lastName: true } } } });
        if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
        const [attendance, grades, fees, wallet, dorm, badges] = await Promise.all([
          db.attendance.count({ where: { studentId: id } }),
          db.gradeRecord.count({ where: { studentId: id } }),
          db.studentFee.count({ where: { studentId: id } }),
          db.studentWallet.findUnique({ where: { studentId: id } }),
          db.dormAssignment.count({ where: { studentId: id, status: "ACTIVE" } }),
          db.studentBadge.count({ where: { studentId: id } }),
        ]);
        return apiOk({ tool, node: { kind, id, name: `${st.user.firstName} ${st.user.lastName}` }, edges: [
          { to: "attendance", count: attendance }, { to: "grades", count: grades }, { to: "fees", count: fees },
          { to: "wallet", count: wallet ? 1 : 0 }, { to: "dormAssignments", count: dorm }, { to: "badges", count: badges },
        ] });
      }
      return apiErr(400, "kind باید class یا student باشد.", "BAD_INPUT");
    }

    if (tool === "forecast") {
      const [classes, rooms] = await Promise.all([
        db.class.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true, capacity: true } }),
        db.dormRoom.findMany({ where: { building: { schoolId }, isActive: true }, select: { id: true, name: true, capacity: true } }),
      ]);
      const classCounts = await db.student.groupBy({ by: ["classId"], where: { classId: { in: classes.map((c) => c.id) }, status: "ACTIVE" }, _count: { _all: true } });
      const countMap = new Map(classCounts.map((c) => [c.classId, c._count._all]));
      const roomCounts = await db.dormAssignment.groupBy({ by: ["roomId"], where: { roomId: { in: rooms.map((r) => r.id) }, status: "ACTIVE" }, _count: { _all: true } });
      const roomMap = new Map(roomCounts.map((c) => [c.roomId, c._count._all]));
      const scenarios = [5, 10, 20];
      return apiOk({
        tool,
        classes: classes.map((c) => {
          const now = countMap.get(c.id) ?? 0;
          return { name: c.name, now, capacity: c.capacity, overCapacity: now > c.capacity, scenarios: scenarios.map((p) => ({ growth: p, projected: Math.round(now * (1 + p / 100)) })) };
        }),
        dormRooms: rooms.map((r) => {
          const now = roomMap.get(r.id) ?? 0;
          return { name: r.name, now, capacity: r.capacity, overCapacity: now > r.capacity, scenarios: scenarios.map((p) => ({ growth: p, projected: Math.round(now * (1 + p / 100)) })) };
        }),
        note: "سناریوهای رشد ۵٪/۱۰٪/۲۰٪ حسابی‌اند، نه پیش‌بینی مدل.",
      });
    }

    if (tool === "permissions") {
      return apiOk({ tool, catalog: PERMISSION_CATALOG, note: "برای ارزیابی، POST بفرستید: { role, permissions } — بدون هیچ تغییری در داده." });
    }

    return apiErr(400, "tool باید یکی از simulation | history | permissions | quality | dependency | forecast باشد.", "BAD_TOOL");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const body = await readJson<{ role?: string; permissions?: string[] }>(req);
    const role = String(body.role ?? "");
    const perms = Array.isArray(body.permissions) ? body.permissions.filter((p) => typeof p === "string") : [];
    if (!role) return apiErr(400, "role لازم است.", "BAD_INPUT");
    const fakeUser = { role, permissions: perms };
    const results = PERMISSION_CATALOG.map((c) => ({ key: c.key, label: c.label, allowed: hasPermission(fakeUser, c.key) }));
    return apiOk({ role, permissions: perms, results, note: "ارزیابی خشک است؛ هیچ مجوز یا نقشی تغییر نکرد." });
  } catch (e) {
    return handleApiError(e);
  }
}
