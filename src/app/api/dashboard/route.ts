import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError , actingSchoolIdFor } from "@/lib/api";
import { todayJalali, jalaliDayOfWeek, toJalaliKey, jalaliParts } from "@/lib/persian";
import { ensureAutoBackup } from "@/lib/backup";
import { getSettings } from "@/lib/settings";

function periodNow(): number {
  const h = new Date().getHours();
  if (h < 8) return 1;
  if (h < 9) return 2;
  if (h < 10) return 3;
  if (h < 11) return 4;
  if (h < 12) return 5;
  if (h < 13) return 5;
  if (h < 14) return 6;
  return 7;
}

/** GET /api/dashboard — داشبورد تطبیقی نقش‌محور + بینش + Why? + سلامت مدرسه */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const actingSchoolId = actingSchoolIdFor(req, me);

    /* ══════════════ داشبورد سطح سرویس ══════════════ */
    if (isService && !actingSchoolId) {
      const [schools, users, students, teachers, classes, outbox, recentAudit, openTickets, blogPosts, lastBackup] = await Promise.all([
        db.school.count({ where: { isActive: true } }),
        db.user.count({ where: { isActive: true, role: { not: "SUPER_ADMIN" } } }),
        db.student.count(),
        db.user.count({ where: { role: "TEACHER", isActive: true } }),
        db.class.count({ where: { isActive: true } }),
        db.shadOutbox.count({ where: { status: "SENT" } }),
        db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        db.ticket.count({ where: { status: { in: ["OPEN", "ANSWERED"] } } }),
        db.blogPost.count({ where: { status: "PUBLISHED" } }),
        db.backup.findFirst({ orderBy: { createdAt: "desc" } }),
      ]);

      const monthKeys: string[] = [];
      const now = new Date();
      for (let i = 11; i >= 0; i -= 1) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        monthKeys.push(d.toISOString().slice(0, 7));
      }
      const allSchools = await db.school.findMany({ select: { createdAt: true } });
      const schoolGrowth = monthKeys.map((k) => ({
        month: k,
        count: allSchools.filter((s) => s.createdAt.toISOString().slice(0, 7) <= k).length,
      }));
      // رشد کاربران و دانش‌آموزان با همان کلیدهای ماهانهٔ رشد مدارس (انباشته تا پایان هر ماه)
      const [allUsersCreated, allStudentsCreated] = await Promise.all([
        db.user.findMany({ select: { createdAt: true } }),
        db.student.findMany({ select: { createdAt: true } }),
      ]);
      const usersGrowth = monthKeys.map((k) => ({
        month: k,
        count: allUsersCreated.filter((u) => u.createdAt.toISOString().slice(0, 7) <= k).length,
      }));
      const studentsGrowth = monthKeys.map((k) => ({
        month: k,
        count: allStudentsCreated.filter((u) => u.createdAt.toISOString().slice(0, 7) <= k).length,
      }));

      const settings = await getSettings();
      let autoCreated = false;
      try {
        autoCreated = await ensureAutoBackup(settings.autoBackupDays);
      } catch { /* خالی */ }

      const weekAgo = new Date(Date.now() - 7 * 86400000);
      const newUsers = await db.user.count({ where: { createdAt: { gte: weekAgo } } });
      // تغییرات از دیروز
      const twoDaysAgo = new Date(Date.now() - 2 * 86400000);
      const [newUsersYesterday, ticketsYesterday] = await Promise.all([
        db.user.count({ where: { createdAt: { gte: twoDaysAgo } } }),
        db.ticket.count({ where: { createdAt: { gte: twoDaysAgo } } }),
      ]);

      /* ── راند ۱۷: داشبورد کامل سوپرادمین — آمار ریز سیستم ── */
      const dayAgo = new Date(Date.now() - 86400000);
      const [usersByRole, loginEvents7d, logins24h, ticketsByStatus, recentSignups, messagesCount, notifsCount, dbSize] = await Promise.all([
        db.user.groupBy({ by: ["role"], where: { isActive: true, role: { not: "SUPER_ADMIN" } }, _count: { _all: true } }),
        db.loginEvent.findMany({ where: { createdAt: { gte: weekAgo } }, select: { status: true, createdAt: true } }),
        db.loginEvent.count({ where: { createdAt: { gte: dayAgo }, status: "SUCCESS" } }),
        db.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
        db.user.findMany({
          orderBy: { createdAt: "desc" }, take: 8,
          select: { id: true, firstName: true, lastName: true, role: true, createdAt: true, school: { select: { name: true } } },
        }),
        db.message.count(),
        db.notification.count(),
        (async () => {
          try {
            const fs = await import("fs/promises");
            const st = await fs.stat(process.env.DATABASE_URL?.replace(/^file:/, "") || "db/custom.db");
            return st.size;
          } catch {
            return null;
          }
        })(),
      ]);

      // روند ورودها (۷ روز): موفق/ناموفق در روز
      const loginTrend: Array<{ date: string; success: number; failed: number }> = [];
      for (let i = 6; i >= 0; i -= 1) {
        const dayStart = new Date(Date.now() - i * 86400000);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const inDay = loginEvents7d.filter((e) => e.createdAt >= dayStart && e.createdAt < dayEnd);
        loginTrend.push({
          date: toJalaliKey(dayStart),
          success: inDay.filter((e) => e.status === "SUCCESS").length,
          failed: inDay.filter((e) => e.status !== "SUCCESS").length,
        });
      }

      // بزرگ‌ترین مدارس بر پایه شمار دانش‌آموز (Student رابطه FK به School ندارد → groupBy)
      const [schoolRows, studentCounts, teacherCounts, classCounts] = await Promise.all([
        db.school.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
        db.student.groupBy({ by: ["schoolId"], _count: { _all: true } }),
        db.user.groupBy({ by: ["schoolId"], where: { role: "TEACHER", isActive: true }, _count: { _all: true } }),
        db.class.groupBy({ by: ["schoolId"], where: { isActive: true }, _count: { _all: true } }),
      ]);
      const topSchools = schoolRows
        .map((r) => ({ id: r.id, name: r.name, students: studentCounts.find((c) => c.schoolId === r.id)?._count._all ?? 0 }))
        .filter((r) => r.students > 0)
        .sort((a, b) => b.students - a.students)
        .slice(0, 6);
      // همهٔ مدارس فعال با شمار دانش‌آموز/معلم/کلاس — برای جدول کامل داشبورد سرویس
      const allSchoolsTable = schoolRows
        .map((r) => ({
          id: r.id,
          name: r.name,
          students: studentCounts.find((c) => c.schoolId === r.id)?._count._all ?? 0,
          teachers: teacherCounts.find((c) => c.schoolId === r.id)?._count._all ?? 0,
          classes: classCounts.find((c) => c.schoolId === r.id)?._count._all ?? 0,
        }))
        .sort((a, b) => b.students - a.students);

      return apiOk({
        scope: "service",
        stats: {
          schools, users, students, teachers, classes, shadSent: outbox,
          openTickets, blogPosts, newUsers,
          backup: lastBackup ? { at: lastBackup.createdAt, kind: lastBackup.kind, filename: lastBackup.filename } : null,
          autoCreated,
          logins24h,
          messages: messagesCount,
          notifications: notifsCount,
        },
        whatChanged: {
          newUsers: newUsers - newUsersYesterday,
          newTickets: ticketsYesterday,
        },
        schoolGrowth,
        usersGrowth,
        studentsGrowth,
        allSchools: allSchoolsTable,
        recentAudit,
        /* ریز-آمار سیستم (راند ۱۷) */
        system: {
          nodeVersion: process.version,
          uptimeSec: Math.round(process.uptime()),
          memoryMb: Math.round(process.memoryUsage().rss / 1048576),
          platform: `${process.platform} ${process.arch}`,
          dbSizeBytes: dbSize,
          env: process.env.NODE_ENV ?? "development",
        },
        usersByRole: usersByRole.map((r) => ({ role: r.role, count: r._count._all })),
        loginTrend,
        ticketsByStatus: ticketsByStatus.map((t) => ({ status: t.status, count: t._count._all })),
        recentSignups,
        topSchools: topSchools.map((s) => ({
          id: s.id, name: s.name,
          students: s.students,
        })),
      });
    }

    /* ══════════════ مدرسه فعال ══════════════ */
    let schoolId = actingSchoolId ?? me.schoolId;
    // والد/دانش‌آموزِ بدون schoolId ولی با پیوند فرزند/پروفایل: مدرسه را از همان
    // پیوند بگیر تا به‌جای صفحهٔ مردهٔ «متصل نیستید»، داشبورد واقعی خودشان را ببینند.
    if (!schoolId && me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, include: { student: { select: { schoolId: true } } } });
      schoolId = link?.student.schoolId ?? null;
    }
    if (!schoolId && me.role === "STUDENT") {
      const profile = await db.student.findFirst({ where: { userId: me.id }, select: { schoolId: true } });
      schoolId = profile?.schoolId ?? null;
    }
    if (!schoolId) return apiOk({ scope: "none", stats: {} });
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) return apiOk({ scope: "none", stats: {} });
    const todayKey = todayJalali();
    const yesterdayKey = toJalaliKey(new Date(Date.now() - 86400000));

    /* ─────────── مدیر / معاون ─────────── */
    if (me.role === "MANAGER" || me.role === "DEPUTY" || (me.role === "ADMIN" && actingSchoolId) || (me.role === "SUPER_ADMIN" && actingSchoolId)) {
      /* ردیف ۱ موازی: همهٔ کوئری‌هایی که فقط schoolId/me.id می‌خواهند (کلاس‌ها، دانش‌آموزان و دستهٔ شمارنده‌ها) — قبلاً ترتیبی بودند */
      const [classRows, studentRows, teachers, parents, subjects, upcomingEvents, announcements, outboxFailed, outboxSent, unread, pendingChanges, fees, shadSession, site, leads, openTickets, pendingLeaves, pendingMeetings] = await Promise.all([
        db.class.findMany({ where: { schoolId, isActive: true }, select: { id: true, name: true, grade: true } }),
        db.student.findMany({
          where: { schoolId },
          select: { id: true, userId: true, classId: true, user: { select: { firstName: true, lastName: true, birthDate: true } }, class: { select: { name: true } } },
        }),
        db.user.count({ where: { schoolId, role: "TEACHER", isActive: true } }),
        db.user.count({ where: { schoolId, role: "PARENT", isActive: true } }),
        db.subject.count({ where: { schoolId } }),
        db.schoolEvent.findMany({ where: { schoolId, startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 6 }),
        db.announcement.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 6 }),
        db.shadOutbox.count({ where: { schoolId, status: "FAILED" } }),
        db.shadOutbox.count({ where: { schoolId, status: "SENT" } }),
        db.message.count({ where: { recipientId: me.id, readAt: null } }),
        db.profileChangeRequest.count({ where: { status: "PENDING", user: { schoolId, role: { in: ["DEPUTY", "TEACHER", "STUDENT", "PARENT"] } } } }),
        db.studentFee.groupBy({ by: ["status"], where: { schoolId }, _count: { _all: true } }),
        db.shadSession.findUnique({ where: { schoolId }, select: { status: true, accountName: true } }),
        db.schoolSite.findUnique({ where: { schoolId }, select: { subdomain: true, published: true, templateId: true, views: true } }),
        db.schoolLead.count({ where: { schoolId, status: "NEW" } }),
        db.ticket.count({ where: { status: "OPEN", user: { schoolId } } }),
        db.leaveRequest.count({ where: { schoolId, status: "PENDING" } }),
        db.meeting.count({ where: { schoolId, status: "PENDING" } }),
      ]);

      const ids = classRows.map((c) => c.id);

      /* ردیف ۲ موازی: همهٔ کوئری‌های وابسته به ids (حضور امروز/دیروز/روند ۷روزه، نمرات کلاس‌ها و همهٔ نمرات) — قبلاً ترتیبی و حلقه‌ای بودند */
      const trendKeys: string[] = [];
      for (let i = 6; i >= 0; i -= 1) trendKeys.push(toJalaliKey(new Date(Date.now() - i * 86400000)));
      const [attToday, attYesterday, trendRows, gradeRowsByClass, allGrades] = await Promise.all([
        db.attendance.findMany({
          where: { classId: { in: ids }, date: todayKey },
          include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
        }),
        db.attendance.findMany({ where: { classId: { in: ids }, date: yesterdayKey }, select: { status: true } }),
        Promise.all(trendKeys.map((key) => db.attendance.findMany({ where: { classId: { in: ids }, date: key }, select: { status: true } }))),
        Promise.all(classRows.slice(0, 8).map((c) => db.gradeRecord.findMany({ where: { classId: c.id }, select: { score: true, weight: true } }))),
        db.gradeRecord.findMany({
          where: { classId: { in: ids } },
          select: { studentId: true, subjectId: true, score: true, weight: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      /* ── حضور امروز: غایبین و تأخیرها با اسم ── */
      const absentToday = attToday.filter((a) => a.status === "ABSENT");
      const lateToday = attToday.filter((a) => a.status === "LATE");
      const presentCount = attToday.filter((a) => a.status === "PRESENT").length;
      const attendanceRateToday = attToday.length ? Math.round(((attToday.length - absentToday.length) / attToday.length) * 100) : null;
      const attendanceRateYesterday = attYesterday.length ? Math.round(((attYesterday.length - attYesterday.filter((a) => a.status === "ABSENT").length) / attYesterday.length) * 100) : null;

      /* ── روند حضور ۷ روز ── */
      const attendanceTrend: { date: string; present: number; absent: number; late: number; total: number }[] = trendKeys.map((key, idx) => {
        const rows = trendRows[idx];
        return {
          date: key,
          total: rows.length,
          present: rows.filter((r) => r.status === "PRESENT").length,
          absent: rows.filter((r) => r.status === "ABSENT").length,
          late: rows.filter((r) => r.status === "LATE").length,
        };
      });

      /* ── میانگین نمرات کلاس‌ها + پایه‌ها ── */
      const gradeByClass: { name: string; avg: number | null }[] = [];
      const gradeByGrade = new Map<string, { sum: number; w: number }>();
      classRows.slice(0, 8).forEach((c, idx) => {
        const grades = gradeRowsByClass[idx];
        const w = grades.reduce((s, g) => s + g.weight, 0);
        const avg = w > 0 ? +(grades.reduce((s, g) => s + g.score * g.weight, 0) / w).toFixed(2) : null;
        gradeByClass.push({ name: c.name, avg });
        if (avg !== null && w > 0) {
          const cur = gradeByGrade.get(c.grade) ?? { sum: 0, w: 0 };
          gradeByGrade.set(c.grade, { sum: cur.sum + avg * w, w: cur.w + w });
        }
      });
      const perStudent = new Map<string, { early: { s: number; w: number }; late: { s: number; w: number } }>();
      for (const g of allGrades) {
        const cur = perStudent.get(g.studentId) ?? { early: { s: 0, w: 0 }, late: { s: 0, w: 0 } };
        const half = g.createdAt < new Date(Date.now() - 21 * 86400000);
        if (half) { cur.early.s += g.score * g.weight; cur.early.w += g.weight; }
        else { cur.late.s += g.score * g.weight; cur.late.w += g.weight; }
        perStudent.set(g.studentId, cur);
      }
      const riskStudents: Array<{ name: string; class: string; early: number; late: number; drop: number }> = [];
      for (const [studentId, v] of perStudent) {
        if (v.early.w >= 2 && v.late.w >= 2) {
          const early = v.early.s / v.early.w;
          const late = v.late.s / v.late.w;
          const drop = early - late;
          if (drop >= 2.5) {
            const st = studentRows.find((s) => s.id === studentId);
            if (st) riskStudents.push({ name: `${st.user.firstName} ${st.user.lastName}`, class: st.class?.name ?? "—", early: +early.toFixed(1), late: +late.toFixed(1), drop: +drop.toFixed(1) });
          }
        }
      }
      riskStudents.sort((a, b) => b.drop - a.drop);

      /* ── مالی ── */
      const feeSummary = {
        unpaid: fees.find((f) => f.status === "UNPAID")?._count._all ?? 0,
        paid: fees.find((f) => f.status === "PAID")?._count._all ?? 0,
        waived: fees.find((f) => f.status === "WAIVED")?._count._all ?? 0,
        totalUnpaidAmount: 0,
        monthRevenue: 0,
        paidRatio: 0,
      };
      const jNow = jalaliParts();
      /* ردیف ۳ موازی: مالی، کلاس‌های در حال برگزاری، ثبت‌کنندگان حضور، فید رفتار و شمارندهٔ دیروز — همه مستقل از هم */
      const dow = jalaliDayOfWeek();
      const pNow = periodNow();
      const [[unpaidSum, paidFees], slotsNow, recordedRows, behaviorFeed, feesUnpaidYesterdayCount] = await Promise.all([
        Promise.all([
          db.studentFee.aggregate({ where: { schoolId, status: "UNPAID" }, _sum: { amount: true } }),
          db.studentFee.findMany({ where: { schoolId, status: "PAID", paidAt: { not: null } }, select: { amount: true, paidAt: true } }),
        ]),
        db.scheduleSlot.findMany({
          where: { classId: { in: ids }, dayOfWeek: dow, period: pNow },
          include: { class: { select: { name: true } }, subject: { select: { name: true } }, teacher: { select: { firstName: true, lastName: true } } },
        }),
        db.attendance.findMany({ where: { classId: { in: ids }, date: todayKey }, select: { recordedById: true } }),
        db.behaviorRecord.findMany({
          where: { schoolId },
          orderBy: { createdAt: "desc" },
          take: 8,
          include: { student: { include: { user: { select: { firstName: true, lastName: true } } } } },
        }),
        db.studentFee.count({
          where: { schoolId, status: "UNPAID", updatedAt: { lt: new Date(Date.now() - 86400000) } },
        }),
      ]);
        feeSummary.totalUnpaidAmount = unpaidSum._sum.amount ?? 0;
        // درآمد ماه جاری (شمسی): تقریب — ماه شمسی جاری با تبدیل paidAt
        feeSummary.monthRevenue = paidFees
          .filter((f) => {
            if (!f.paidAt) return false;
            const j = jalaliParts(f.paidAt);
            return j.y === jNow.y && j.m === jNow.m;
          })
          .reduce((s, f) => s + f.amount, 0);
        const total = feeSummary.paid + feeSummary.unpaid;
        feeSummary.paidRatio = total > 0 ? Math.round((feeSummary.paid / total) * 100) : 0;

      /* ── معلمان حاضر (ثبت حضور ثبت کرده‌اند) ── */
      const teacherIdsToday = new Set(slotsNow.map((s) => s.teacherId));
      const teachersWhoRecorded = new Set(
        recordedRows
          .map((a) => a.recordedById)
          .filter(Boolean)
      );

      /* ── امتیاز سلامت مدرسه ── */
      const gpaSchool = (() => {
        let s = 0, w = 0;
        for (const v of perStudent.values()) { s += v.early.s + v.late.s; w += v.early.w + v.late.w; }
        return w > 0 ? s / w : null;
      })();
      const behaviorPos = behaviorFeed.filter((b) => b.kind === "POSITIVE").length;
      const behaviorNeg = behaviorFeed.length - behaviorPos;
      const staffLoad = slotsNow.length ? Math.min(100, Math.round((slotsNow.length / Math.max(1, teachers)) * 100)) : 50;
      // ⚠ دادهٔ غایب = null (و در UI «—») — قبلاً مقادیر ۷۰/۸۵/۸۵ ساختگی نمایش داده می‌شد
      const parts: Array<number | null> = [
        gpaSchool !== null ? Math.max(0, Math.min(100, Math.round((gpaSchool / 20) * 100))) : null,
        attendanceRateToday,
        feeSummary.paidRatio || null,
        Math.max(40, 100 - Math.min(60, unread * 4 + pendingChanges * 5)),
        slotsNow.length ? Math.max(30, 100 - Math.round(staffLoad * 0.4)) : null,
      ];
      const valid = parts.filter((p): p is number => p !== null);
      const healthScore: { academics: number | null; attendance: number | null; finance: number | null; communication: number | null; staffLoad: number | null; overall: number | null } = {
        academics: parts[0],
        attendance: parts[1],
        finance: parts[2],
        communication: parts[3],
        staffLoad: parts[4],
        overall: valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null,
      };

      /* ── تولدهای این هفته و هفته قبل ── */
      const now2 = new Date();
      const birthdays = studentRows
        .filter((s) => s.user.birthDate)
        .map((s) => {
          const b = s.user.birthDate!;
          const thisYear = new Date(now2.getFullYear(), b.getMonth(), b.getDate());
          const days = Math.floor((thisYear.getTime() - now2.getTime()) / 86400000);
          return { name: `${s.user.firstName} ${s.user.lastName}`, class: s.class?.name ?? "—", days };
        })
        .filter((s) => s.days >= -7 && s.days <= 7);

      return apiOk({
        scope: "school",
        school: { id: school.id, name: school.name, code: school.code, logoUrl: school.logoUrl, province: school.province, county: school.county },
        acting: !!actingSchoolId,
        stats: {
          students: studentRows.length, teachers, parents, classes: classRows.length, subjects,
          attendanceToday: attToday.length,
          attendancePresent: presentCount,
          absentTodayCount: absentToday.length,
          lateTodayCount: lateToday.length,
          classesInSession: slotsNow.length,
          teachersPresent: teachersWhoRecorded.size,
          teachersScheduledNow: teacherIdsToday.size,
          shadFailed: outboxFailed, shadSent: outboxSent,
          unread, pendingChanges, newLeads: leads, openTickets, pendingLeaves, pendingMeetings,
        },
        todayDetail: {
          absent: absentToday.map((a) => ({ name: `${a.student.user.firstName} ${a.student.user.lastName}`, class: a.student.class?.name ?? "—" })),
          late: lateToday.map((a) => ({ name: `${a.student.user.firstName} ${a.student.user.lastName}`, class: a.student.class?.name ?? "—" })),
          inSession: slotsNow.map((s) => ({ className: s.class?.name, subject: s.subject?.name, teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : "—" })),
          events: upcomingEvents.filter((e) => e.startAt.toDateString() === new Date().toDateString()),
        },
        riskStudents: riskStudents.slice(0, 8),
        feeSummary,
        gradeByClass,
        gradeByGrade: [...gradeByGrade.entries()].map(([grade, v]) => ({ grade, avg: +(v.sum / v.w).toFixed(2) })),
        healthScore,
        whatChanged: {
          attendance: attendanceRateToday !== null && attendanceRateYesterday !== null ? attendanceRateToday - attendanceRateYesterday : null,
          unpaidFees: feeSummary.unpaid - feesUnpaidYesterdayCount,
          riskStudents: null, // مقایسهٔ دیروز نیازمند اسنپ‌شات روزانه است — تا آن زمان پنهان می‌ماند
          newRequests: null, // این مقادیر جمعِ امروزند نه «دلتا» — نمایش دلتا بدون پایه دیروز صادقانه نیست
        },
        behaviorFeed: behaviorFeed.map((b) => ({
          kind: b.kind, reason: b.reason, note: b.note,
          student: `${b.student.user.firstName} ${b.student.user.lastName}`,
          at: b.createdAt,
        })),
        birthdays,
        shad: shadSession ? { status: shadSession.status, accountName: shadSession.accountName } : { status: "NONE", accountName: null },
        site: site ? { ...site, url: `/s/${site.subdomain}` } : null,
        attendanceTrend,
        upcomingEvents,
        announcements,
        today: todayKey,
      });
    }

    /* ─────────── معلم ─────────── */
    if (me.role === "TEACHER") {
      const [assignments, myClasses, unread, todaySlots, pendingChangesCount] = await Promise.all([
        db.teachingAssignment.findMany({ where: { teacherId: me.id }, include: { class: true, subject: true } }),
        db.class.count({ where: { schoolId, homeroomTeacherId: me.id } }),
        db.message.count({ where: { recipientId: me.id, readAt: null } }),
        db.scheduleSlot.findMany({
          where: { teacherId: me.id, dayOfWeek: jalaliDayOfWeek() },
          include: { class: true, subject: true },
          orderBy: { period: "asc" },
        }),
        db.profileChangeRequest.count({ where: { userId: me.id, status: "PENDING" } }),
      ]);
      const classIds = [...new Set(assignments.map((a) => a.classId))];
      const [studentCount, myAssignments, pendingLeaves, meetingsToday, parentUnread] = await Promise.all([
        db.student.count({ where: { classId: { in: classIds }, user: { isActive: true } } }),
        db.assignment.findMany({ where: { teacherId: me.id }, orderBy: { dueDate: "desc" }, take: 6, include: { class: true, subject: true } }),
        db.leaveRequest.count({ where: { userId: me.id, status: "PENDING" } }),
        db.meeting.findMany({ where: { staffId: me.id, status: "PENDING" }, include: { requestedBy: { select: { firstName: true, lastName: true } } } }),
        db.message.count({
          where: { recipientId: me.id, readAt: null, sender: { role: "PARENT" } },
        }),
      ]);
      // زنگ‌های ثبت‌نشده امروز: کلاس‌هایی که امروز زنگ داشته‌ام ولی حضورغیاب ثبت نشده
      const attRecorded = new Set(
        (await db.attendance.findMany({ where: { classId: { in: classIds }, date: todayKey, recordedById: me.id }, select: { classId: true } })).map((a) => a.classId)
      );
      const missingAttendance = todaySlots.filter((s) => !attRecorded.has(s.classId)).length;

      return apiOk({
        scope: "teacher",
        stats: {
          subjects: [...new Set(assignments.map((a) => a.subject.name))].length,
          classes: classIds.length,
          students: studentCount,
          homeroom: myClasses,
          unread,
          pendingChanges: pendingChangesCount,
          missingAttendance,
          parentUnread,
          pendingLeaves,
          pendingMeetings: meetingsToday.length,
        },
        todaySlots, assignments: myAssignments,
        pendingMeetings: meetingsToday.slice(0, 5),
        today: todayKey,
      });
    }

    /* ─────────── دانش‌آموز ─────────── */
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({
        where: { userId: me.id },
        include: { class: { include: { homeroomTeacher: { select: { firstName: true, lastName: true } } } } },
      });
      if (!profile) return apiOk({ scope: "none", stats: {} });
      const [grades, unread, todaySlots, assignments, attendance, fees, badges, behavior] = await Promise.all([
        db.gradeRecord.findMany({ where: { studentId: profile.id }, include: { subject: true }, orderBy: { createdAt: "asc" } }),
        db.message.count({ where: { recipientId: me.id, readAt: null } }),
        profile.classId
          ? db.scheduleSlot.findMany({
              where: { classId: profile.classId, dayOfWeek: jalaliDayOfWeek() },
              include: { subject: true, teacher: { select: { firstName: true, lastName: true } } },
              orderBy: { period: "asc" },
            })
          : Promise.resolve([]),
        profile.classId
          ? db.assignment.findMany({
              where: { classId: profile.classId, dueDate: { gte: new Date() } },
              include: { subject: true, teacher: { select: { firstName: true, lastName: true } } },
              orderBy: { dueDate: "asc" }, take: 6,
            })
          : Promise.resolve([]),
        db.attendance.findMany({ where: { studentId: profile.id }, orderBy: { date: "asc" } }),
        db.studentFee.findMany({ where: { studentId: profile.id }, orderBy: { dueDate: "asc" } }),
        db.studentBadge.findMany({ where: { studentId: profile.id }, include: { badge: true }, orderBy: { awardedAt: "desc" } }),
        db.behaviorRecord.findMany({ where: { studentId: profile.id }, orderBy: { createdAt: "desc" }, take: 10 }),
      ]);

      // میانگین‌ها + روند هر درس
      const subjectMap = new Map<string, { sum: number; w: number; items: Array<{ score: number; at: Date }> }>();
      let weighted = 0, weightSum = 0;
      for (const g of grades) {
        weighted += g.score * g.weight; weightSum += g.weight;
        const cur = subjectMap.get(g.subjectId) ?? { sum: 0, w: 0, items: [] };
        cur.sum += g.score * g.weight; cur.w += g.weight; cur.items.push({ score: g.score, at: g.createdAt });
        subjectMap.set(g.subjectId, cur);
      }
      const myGpa = weightSum > 0 ? +(weighted / weightSum).toFixed(2) : null;

      // رتبه در کلاس
      let classRank: number | null = null, classSize = 0;
      if (profile.classId) {
        const classmates = await db.student.findMany({ where: { classId: profile.classId }, select: { id: true } });
        classSize = classmates.length;
        const classGrades = await db.gradeRecord.findMany({
          where: { classId: profile.classId },
          select: { studentId: true, score: true, weight: true },
        });
        const gpaMap = new Map<string, { s: number; w: number }>();
        for (const g of classGrades) {
          const cur = gpaMap.get(g.studentId) ?? { s: 0, w: 0 };
          cur.s += g.score * g.weight; cur.w += g.weight;
          gpaMap.set(g.studentId, cur);
        }
        const rankings = [...gpaMap.entries()]
          .filter(([, v]) => v.w > 0)
          .map(([id, v]) => ({ id, gpa: v.s / v.w }))
          .sort((a, b) => b.gpa - a.gpa);
        classRank = rankings.findIndex((r) => r.id === profile.id) + 1 || null;
      }

      // روند درس‌ها (سه نمره اخیر هر درس → جهت)
      const subjectTrends = [...subjectMap.entries()].map(([subjectId, v]) => {
        const recent = v.items.slice(-3);
        const first = recent[0]?.score ?? 0;
        const last = recent[recent.length - 1]?.score ?? 0;
        const subject = grades.find((g) => g.subjectId === subjectId)?.subject;
        return {
          subject: subject?.name ?? "—",
          avg: +(v.sum / v.w).toFixed(2),
          delta: recent.length >= 2 ? +(last - first).toFixed(1) : 0,
        };
      }).sort((a, b) => b.avg - a.avg);

      const absences = attendance.filter((a) => a.status === "ABSENT").length;
      const lates = attendance.filter((a) => a.status === "LATE").length;
      const attendanceRate = attendance.length > 0 ? Math.round(((attendance.length - absences) / attendance.length) * 100) : null;
      const behaviorPoints = behavior.reduce((s, b) => s + b.points, 0);

      return apiOk({
        scope: "student",
        profile: {
          class: profile.class ? { id: profile.class.id, name: profile.class.name, grade: profile.class.grade } : null,
          homeroomTeacher: profile.class?.homeroomTeacher ?? null,
          studentNumber: profile.studentNumber,
        },
        stats: {
          gpa: myGpa,
          subjects: subjectMap.size,
          absences, lates,
          attendanceRate,
          unread,
          unpaidFees: fees.filter((f) => f.status === "UNPAID").length,
          classRank, classSize,
          percentile: classRank && classSize ? Math.round((1 - classRank / classSize) * 100) : null,
          behaviorPoints,
          badgePoints: badges.reduce((s, b) => s + b.badge.points, 0),
        },
        subjectTrends: subjectTrends.slice(0, 6),
        bestSubject: subjectTrends[0] ?? null,
        worstSubject: subjectTrends.length ? subjectTrends[subjectTrends.length - 1] : null,
        fees,
        badges,
        featuredBadge: badges.find((b) => b.isFeatured)?.badge ?? null,
        behavior: behavior.map((b) => ({ kind: b.kind, reason: b.reason, points: b.points, at: b.createdAt, note: b.note })),
        grades: grades.slice(-10).map((g) => ({ subject: g.subject.name, score: g.score, kind: g.kind, date: g.createdAt })),
        todaySlots, assignments, today: todayKey,
      });
    }

    /* ─────────── والد ─────────── */
    if (me.role === "PARENT") {
      const children = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: {
          student: {
            include: {
              class: true,
              user: { select: { firstName: true, lastName: true } },
            },
          },
        },
      });
      const result: Array<{
        relation: string;
        studentId: string;
        student: {
          name: string; class: string; grade: string | null; gpa: number | null; absences: number; lates: number;
          attendanceRate: number | null; unpaidFees: number; unpaidAmount: number; behaviorPoints: number;
          nextClass: string | null; homework: number;
        };
      }> = [];
      for (const ch of children) {
        const [grades, attendance, unpaidFees, behavior, nextSlots] = await Promise.all([
          db.gradeRecord.findMany({ where: { studentId: ch.studentId }, include: { subject: true } }),
          db.attendance.findMany({ where: { studentId: ch.studentId } }),
          db.studentFee.findMany({ where: { studentId: ch.studentId, status: "UNPAID" } }),
          db.behaviorRecord.findMany({ where: { studentId: ch.studentId } }),
          ch.student.classId
            ? db.scheduleSlot.findMany({
                where: { classId: ch.student.classId, dayOfWeek: jalaliDayOfWeek() },
                include: { subject: true },
                orderBy: { period: "asc" },
              })
            : Promise.resolve([]),
        ]);
        let w = 0, ws = 0;
        for (const g of grades) { w += g.score * g.weight; ws += g.weight; }
        const absences = attendance.filter((a) => a.status === "ABSENT").length;
        const homework = await db.assignment.count({ where: { classId: ch.student.classId ?? "" } });
        const pNow = periodNow();
        const next = nextSlots.find((s) => s.period >= pNow);
        result.push({
          relation: ch.relation,
          studentId: ch.studentId,
          student: {
            name: `${ch.student.user.firstName} ${ch.student.user.lastName}`,
            class: ch.student.class?.name ?? "بدون کلاس",
            grade: ch.student.class?.grade ?? null,
            gpa: ws > 0 ? +(w / ws).toFixed(2) : null,
            absences,
            lates: attendance.filter((a) => a.status === "LATE").length,
            attendanceRate: attendance.length ? Math.round(((attendance.length - absences) / attendance.length) * 100) : null,
            unpaidFees: unpaidFees.length,
            unpaidAmount: unpaidFees.reduce((s, f) => s + f.amount, 0),
            behaviorPoints: behavior.reduce((s, b) => s + b.points, 0),
            nextClass: next ? `${next.subject?.name ?? ""} — زنگ ${next.period}` : null,
            homework,
          },
        });
      }
      const [unread, meetings, announcementsToday] = await Promise.all([
        db.message.count({ where: { recipientId: me.id, readAt: null } }),
        db.meeting.findMany({
          where: { requestedById: me.id, status: { in: ["PENDING", "APPROVED"] } },
          include: { staff: { select: { firstName: true, lastName: true } } },
          orderBy: { slotStart: "asc" },
          take: 4,
        }),
        db.announcement.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 5 }),
      ]);
      return apiOk({
        scope: "parent",
        stats: { children: result.length, unread, pendingChanges: 0 },
        children: result,
        meetings,
        announcements: announcementsToday,
        today: todayKey,
      });
    }

    return apiOk({ scope: "none", stats: {} });
  } catch (e) {
    return handleApiError(e);
  }
}
