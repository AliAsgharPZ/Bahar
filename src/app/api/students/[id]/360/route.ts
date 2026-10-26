import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock, audit } from "@/lib/api";
import { riskScore, attendancePatterns, subjectAbsencePattern } from "@/lib/insights";
import { runAutomations } from "@/lib/automation";
import { calendarToDate } from "@/lib/persian";

/* ============================================================
   بهار | Student 360 — نمای کامل: تایم‌لاین، تگ، اسناد، اهداف،
   پورتفولیو، اقدامات حمایتی، ریسک، الگوی غیبت
   ============================================================ */

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/students/[id]/360 — نمای کامل دانش‌آموز */
/** تبدیل کلید تاریخ تقویم فعال (مثل 1404-07-10) به Date — بدون ISO گره‌خوردن */
function attendanceKeyToDate(key: string): Date {
  const parts = key.split("-").map(Number);
  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) {
    try {
      const d = calendarToDate(parts[0], parts[1], parts[2]);
      if (!Number.isNaN(d.getTime())) return d;
    } catch { /* سقوط پایین */ }
  }
  const fallback = new Date(key);
  return Number.isNaN(fallback.getTime()) ? new Date() : fallback;
}

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const { id } = await ctx.params;
    const student = await db.student.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, nationalId: true, fatherName: true, gender: true, birthDate: true, phone: true, address: true, photoUrl: true, profileImageType: true, avatarConfig: true, birthPlace: true, jobTitle: true } }, // FIX راند ۱۶: فیلدهای آواتار
        class: { select: { id: true, name: true, grade: true, field: true } },
        house: true,
        parents: { include: { parentUser: { select: { firstName: true, lastName: true, phone: true, jobTitle: true, nationalId: true } } } },
        attendances: { orderBy: { date: "desc" }, take: 200 },
        gradeRecords: { include: { subject: true }, orderBy: { createdAt: "desc" }, take: 100 },
        gradeHistory: { include: { changedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 30 },
        behaviorRecords: { orderBy: { createdAt: "desc" }, take: 30 },
        badges: { include: { badge: true }, orderBy: { awardedAt: "desc" } },
        documents: true,
        goals: { orderBy: { createdAt: "desc" } },
        interventions: { include: { startedBy: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" } },
        portfolioItems: { orderBy: { createdAt: "desc" } },
        fees: { orderBy: { dueDate: "asc" } },
        meetings: { include: { staff: { select: { firstName: true, lastName: true } }, requestedBy: { select: { firstName: true, lastName: true } } }, orderBy: { slotStart: "desc" }, take: 10 },
      },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    // دسترسی
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const isManager = (me.role === "MANAGER" || me.role === "DEPUTY") && me.schoolId === student.schoolId;
    const isSelf = student.user.id === me.id;
    const isMyChild = me.role === "PARENT" && student.parents.some((p) => p.parentUserId === me.id);
    // معلم فقط وقتی نمای ۳۶۰ را می‌بیند که معلم همان کلاس یا مسئول آن باشد —
    // هم‌مدرسه‌ای بودن کافی نیست (هم‌قاعده با پرونده دانش‌آموز).
    let isTeacherOf = false;
    if (me.role === "TEACHER" && me.schoolId === student.schoolId && student.classId) {
      const [teaches, homeroom] = await Promise.all([
        db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId: student.classId }, select: { id: true } }),
        db.class.findFirst({ where: { id: student.classId, homeroomTeacherId: me.id }, select: { id: true } }),
      ]);
      isTeacherOf = !!(teaches || homeroom);
    }
    if (!isService && !isManager && !isSelf && !isMyChild && !isTeacherOf) {
      return apiErr(403, "مشاهده این دانش‌آموز برای شما مجاز نیست.", "FORBIDDEN");
    }

    // محاسبات تحلیلی
    let w = 0, ws = 0;
    const bySubject = new Map<string, { name: string; sum: number; w: number; items: Array<{ score: number; at: Date }> }>();
    for (const g of student.gradeRecords) {
      w += g.score * g.weight; ws += g.weight;
      const cur = bySubject.get(g.subjectId) ?? { name: g.subject.name, sum: 0, w: 0, items: [] as Array<{ score: number; at: Date }> };
      cur.sum += g.score * g.weight; cur.w += g.weight; cur.items.push({ score: g.score, at: g.createdAt });
      bySubject.set(g.subjectId, cur);
    }
    const gpa = ws > 0 ? +(w / ws).toFixed(2) : null;
    const sorted = [...student.gradeRecords].reverse();
    const half = Math.floor(sorted.length / 2);
    const firstHalf = sorted.slice(0, half);
    const secondHalf = sorted.slice(half);
    const avgOf = (arr: typeof sorted) => arr.length ? arr.reduce((s, g) => s + g.score * g.weight, 0) / arr.reduce((s, g) => s + g.weight, 0) : null;
    const trend = avgOf(firstHalf) !== null && avgOf(secondHalf) !== null ? +(avgOf(secondHalf)! - avgOf(firstHalf)!).toFixed(2) : 0;

    const absences = student.attendances.filter((a) => a.status === "ABSENT").length;
    const lates = student.attendances.filter((a) => a.status === "LATE").length;
    const attendanceRate = student.attendances.length ? Math.round(((student.attendances.length - absences) / student.attendances.length) * 100) : null;
    const behaviorPoints = student.behaviorRecords.reduce((s, b) => s + b.points, 0);
    const risk = riskScore({ attendanceRate, absences, lates, gpa, gpaTrend: trend, behaviorPoints });
    const patterns = attendancePatterns(student.attendances);
    const subjectPattern = subjectAbsencePattern(student.attendances);

    // تایم‌لاین
    type TlItem = { at: Date; kind: string; title: string; detail?: string; tone: "POSITIVE" | "NEGATIVE" | "NEUTRAL" };
    const tl: TlItem[] = [];
    for (const g of student.gradeRecords.slice(0, 40)) {
      tl.push({ at: g.createdAt, kind: "GRADE", title: `نمره ${g.subject.name}: ${g.score}`, detail: g.kind, tone: g.score >= 17 ? "POSITIVE" : g.score < 10 ? "NEGATIVE" : "NEUTRAL" });
    }
    for (const a of student.attendances.slice(0, 60)) {
      // FIX (راند ۱۶): کلید تاریخ حضور در «تقویم فعال» است — تبدیل امن با calendarToDate
      // (قبلاً new Date("1404-07-10") سال ۱۴۰۴ میلادی می‌ساخت و مرتب‌سازی تایم‌لاین خراب می‌شد)
      const at = attendanceKeyToDate(a.date);
      if (a.status === "ABSENT") tl.push({ at, kind: "ATTENDANCE", title: "غیبت", detail: a.period ? `زنگ ${a.period}` : undefined, tone: "NEGATIVE" });
      else if (a.status === "LATE") tl.push({ at, kind: "ATTENDANCE", title: "تأخیر", detail: a.period ? `زنگ ${a.period}` : undefined, tone: "NEGATIVE" });
    }
    for (const b of student.behaviorRecords) {
      tl.push({ at: b.createdAt, kind: "BEHAVIOR", title: (b.kind === "POSITIVE" ? "تشویق: " : "اخطار: ") + b.reason, detail: b.note ?? undefined, tone: b.kind === "POSITIVE" ? "POSITIVE" : "NEGATIVE" });
    }
    for (const sb of student.badges) {
      tl.push({ at: sb.awardedAt, kind: "BADGE", title: `دریافت بج «${sb.badge.title}»`, tone: "POSITIVE" });
    }
    for (const d of student.documents.filter((x) => x.status === "RECEIVED")) {
      tl.push({ at: d.receivedAt ?? d.createdAt, kind: "DOC", title: "دریافت مدرک", tone: "NEUTRAL" });
    }
    for (const m of student.meetings) {
      tl.push({ at: m.createdAt, kind: "MEETING", title: `ملاقات با ${m.staff.firstName} ${m.staff.lastName}`, detail: m.topic, tone: "NEUTRAL" });
    }
    for (const g of student.goals) {
      tl.push({ at: g.createdAt, kind: "GOAL", title: `هدف جدید: ${g.title}`, tone: "NEUTRAL" });
    }
    tl.sort((a, b) => b.at.getTime() - a.at.getTime());

    const canEdit = isManager || isService;
    return apiOk({
      student: { ...student, user: { ...student.user } },
      analytics: { gpa, trend, absences, lates, attendanceRate, behaviorPoints, risk, patterns, subjectPattern },
      subjectBreakdown: [...bySubject.values()].map((s) => ({
        name: s.name, avg: +(s.sum / s.w).toFixed(2),
        trend: s.items.length >= 2 ? +(s.items[s.items.length - 1].score - s.items[0].score).toFixed(1) : 0,
      })).sort((a, b) => b.avg - a.avg),
      timeline: tl.slice(0, 80),
      canEdit,
      tags: JSON.parse(student.tags || "[]") as string[],
      customFields: JSON.parse(student.customFields || "{}") as Record<string, string>,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/students/[id]/360 — تگ/اسناد/اهداف/پورتفولیو/اقدام */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const { id } = await ctx.params;
    const student = await db.student.findUnique({ where: { id }, select: { id: true, schoolId: true, userId: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    const isTeacher = me.role === "TEACHER" && me.schoolId === student.schoolId;
    if (!isManager && !isTeacher) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (me.role !== "SUPER_ADMIN" && me.schoolId !== student.schoolId) return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");

    const body = await readJson<Record<string, unknown>>(req);
    const op = String(body.op ?? "");
    // ثبت رخداد همهٔ عملیاتهای ۳۶۰ — قبلاً هیچ‌کدام audit نمی‌شد
    const log360 = (action: string, meta: Record<string, unknown> = {}) =>
      audit({ user: me, action, entityType: "STUDENT_360", entityId: id, schoolId: student.schoolId, meta: { op, ...meta } });

    if (op === "tags") {
      const tags = (body.tags as string[]) ?? [];
      await db.student.update({ where: { id }, data: { tags: JSON.stringify(tags.slice(0, 12)) } });
      await log360("تغییر تگ‌های دانش‌آموز", { tags: tags.length });
      return apiOk({ tags });
    }
    if (op === "custom-fields") {
      const cf = (body.customFields as Record<string, string>) ?? {};
      await db.student.update({ where: { id }, data: { customFields: JSON.stringify(cf) } });
      await log360("تغییر فیلدهای سفارشی");
      return apiOk({ customFields: cf });
    }
    if (op === "document") {
      const kind = String(body.kind ?? "");
      const status = ["RECEIVED", "PENDING", "REJECTED", "WAIVED"].includes(String(body.status)) ? String(body.status) : "RECEIVED";
      if (!kind) return apiErr(400, "نوع مدرک لازم است.", "BAD_REQUEST");
      const doc = await db.studentDocument.upsert({
        where: { studentId_kind: { studentId: id, kind } },
        create: { studentId: id, kind, status, receivedAt: status === "RECEIVED" ? new Date() : null, expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null, note: (body.note as string) ?? null },
        update: { status, receivedAt: status === "RECEIVED" ? new Date() : null, expiresAt: body.expiresAt ? new Date(String(body.expiresAt)) : null, note: (body.note as string) ?? null },
      });
      await log360("به‌روزرسانی مدرک", { kind });
      return apiOk({ document: doc });
    }
    if (op === "goal") {
      const title = String(body.title ?? "").trim();
      if (!title) return apiErr(400, "عنوان هدف لازم است.", "BAD_REQUEST");
      const goal = await db.studentGoal.create({
        data: {
          studentId: id,
          title,
          metric: ["GPA", "ATTENDANCE", "BEHAVIOR", "CUSTOM"].includes(String(body.metric)) ? String(body.metric) : "CUSTOM",
          targetValue: (body.targetValue as string) ?? null,
          dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
        },
      });
      await log360("افزودن هدف", { title });
      return apiOk({ goal });
    }
    if (op === "goal-status") {
      await db.studentGoal.updateMany({
        where: { id: String(body.goalId), studentId: id },
        data: { status: ["ACTIVE", "ACHIEVED", "DROPPED"].includes(String(body.status)) ? String(body.status) : "ACTIVE", currentValue: (body.currentValue as string) ?? undefined },
      });
      await log360("تغییر وضعیت هدف");
      return apiOk({ ok: true });
    }
    if (op === "intervention") {
      const description = String(body.description ?? "").trim();
      if (!description) return apiErr(400, "شرح اقدام لازم است.", "BAD_REQUEST");
      const iv = await db.intervention.create({
        data: {
          studentId: id,
          startedById: me.id,
          kind: ["MEETING", "PARENT_CONTACT", "SUPPORT_PLAN", "MONITORING"].includes(String(body.kind)) ? String(body.kind) : "MEETING",
          description,
        },
      });
      await log360("ثبت اقدام حمایتی", { kind: body.kind });
      return apiOk({ intervention: iv });
    }
    if (op === "intervention-resolve") {
      await db.intervention.updateMany({
        where: { id: String(body.interventionId), studentId: id },
        data: { status: "RESOLVED", resolvedAt: new Date(), outcome: (body.outcome as string) ?? null },
      });
      await log360("بستن اقدام حمایتی");
      return apiOk({ ok: true });
    }
    if (op === "portfolio") {
      const title = String(body.title ?? "").trim();
      if (!title) return apiErr(400, "عنوان مورد لازم است.", "BAD_REQUEST");
      const item = await db.portfolioItem.create({
        data: {
          studentId: id,
          kind: ["PROJECT", "CERTIFICATE", "COMPETITION", "ARTWORK", "ACHIEVEMENT", "SKILL"].includes(String(body.itemKind)) ? String(body.itemKind) : "PROJECT",
          title,
          description: (body.description as string) ?? null,
          url: (body.url as string) ?? null,
          date: body.date ? new Date(String(body.date)) : null,
        },
      });
      await log360("افزودن به پرونده‌کار", { title });
      return apiOk({ item });
    }
    if (op === "house") {
      // FIX (راند ۱۶): خونه باید متعلق به مدرسه همین دانش‌آموز باشد (نه مدرسه دیگر)
      const houseId = (body.houseId as string) || null;
      if (houseId) {
        const house = await db.house.findFirst({ where: { id: houseId, schoolId: student.schoolId }, select: { id: true } });
        if (!house) return apiErr(400, "این خونه در مدرسه دانش‌آموز وجود ندارد.", "BAD_HOUSE");
      }
      await db.student.update({ where: { id }, data: { houseId } });
      await log360("تغییر خونه", { houseId });
      return apiOk({ ok: true });
    }
    return apiErr(400, "عملیات نامعتبر.", "BAD_OP");
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/students/[id]/360 — اجرای اتوماسیون‌های مرتبط (کارکنان هم‌مدرسه) */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const { id } = await ctx.params;
    const student = await db.student.findUnique({ where: { id }, include: { user: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && me.schoolId !== student.schoolId) {
      return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
    }
    const body = await readJson<{ trigger?: string }>(req);
    if (body.trigger === "BIRTHDAY") {
      await runAutomations({ type: "BIRTHDAY", schoolId: student.schoolId, studentId: student.id, studentName: `${student.user.firstName} ${student.user.lastName}` });
    }
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
