import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

/** کاتالوگ دلایل انضباطی — از قبل تعریف‌شده */
export const BEHAVIOR_REASONS: Record<string, { label: string; kind: "POSITIVE" | "NEGATIVE"; points: number }> = {
  // مثبت
  EXCELLENT_PARTICIPATION: { label: "مشارکت عالی در کلاس", kind: "POSITIVE", points: 2 },
  HELPING_CLASSMATES: { label: "کمک به هم‌کلاسی‌ها", kind: "POSITIVE", points: 3 },
  GOOD_PERFORMANCE: { label: "عملکرد درخشان تحصیلی", kind: "POSITIVE", points: 2 },
  ATTENDANCE_IMPROVEMENT: { label: "بهبود حضور", kind: "POSITIVE", points: 2 },
  PROBLEM_SOLVER: { label: "حل‌کننده مسئله", kind: "POSITIVE", points: 3 },
  TEAM_PLAYER: { label: "روحیه کار تیمی", kind: "POSITIVE", points: 2 },
  CREATIVE_THINKER: { label: "خلاقیت", kind: "POSITIVE", points: 2 },
  COMMUNITY_HELPER: { label: "یاور مدرسه", kind: "POSITIVE", points: 3 },
  HUNDRED_AFFARIN: { label: "۱۰۰ آفرین", kind: "POSITIVE", points: 5 },
  // منفی
  LATE: { label: "تأخیر", kind: "NEGATIVE", points: -1 },
  DISRUPTIVE: { label: "اخلال در کلاس", kind: "NEGATIVE", points: -2 },
  MISSING_HOMEWORK: { label: "تکلیف ننوشته", kind: "NEGATIVE", points: -1 },
  FIGHTING: { label: "دعوا", kind: "NEGATIVE", points: -5 },
  BULLYING: { label: "زورگویی", kind: "NEGATIVE", points: -8 },
  ACADEMIC_MISCONDUCT: { label: "تقلب", kind: "NEGATIVE", points: -5 },
  DISRESPECT: { label: "بی‌احترامی", kind: "NEGATIVE", points: -3 },
  DRESS_CODE: { label: "عدم رعایت پوشش", kind: "NEGATIVE", points: -1 },
  PHONE_USE: { label: "استفاده از موبایل", kind: "NEGATIVE", points: -2 },
};

/** GET /api/behavior — رکوردهای انضباطی (فیلتر: studentId/classId/kind) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN", "ADMIN", "MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT"]);
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const classId = url.searchParams.get("classId");
    const kind = url.searchParams.get("kind");

    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    const where: Record<string, unknown> = {};
    if (me.role === "STUDENT") {
      const s = await db.student.findFirst({ where: { userId: me.id } });
      if (!s) return apiOk({ records: [], reasons: BEHAVIOR_REASONS, myPoints: 0 });
      where.studentId = s.id;
      if (studentId && studentId !== s.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    } else if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const kidIds = kids.map((k) => k.studentId);
      where.studentId = { in: kidIds };
      if (studentId && !kidIds.includes(studentId)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    } else if (me.role === "TEACHER") {
      where.schoolId = me.schoolId ?? "";
    } else {
      where.schoolId = me.schoolId ?? undefined;
    }
    // پارامتر studentId برای کارکنان فقط در همان مدرسه معتبر است
    if (studentId && !isService) {
      const target = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
      if (!target) return apiOk({ records: [] });
      if (target.schoolId !== me.schoolId) return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
      where.studentId = studentId;
    } else if (studentId) {
      where.studentId = studentId;
    }
    if (classId) where.classId = classId;
    if (kind === "POSITIVE" || kind === "NEGATIVE") where.kind = kind;

    const records = await db.behaviorRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
        recordedBy: { select: { firstName: true, lastName: true } },
      },
    });
    return apiOk({ records, reasons: BEHAVIOR_REASONS });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/behavior — ثبت رکورد انضباطی (معلم به بالا) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      studentId: string;
      reason: string;
      note?: string;
    }>(req);
    const reason = BEHAVIOR_REASONS[body.reason];
    if (!reason) return apiErr(400, "دلیل انضباطی نامعتبر است.", "BAD_REASON");
    const student = await db.student.findUnique({
      where: { id: body.studentId },
      include: {
        parents: { select: { parentUserId: true } },
        user: { select: { firstName: true, lastName: true } },
      },
    });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && me.schoolId !== student.schoolId) {
      return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
    }
    const record = await db.behaviorRecord.create({
      data: {
        studentId: student.id,
        classId: student.classId ?? null,
        schoolId: student.schoolId,
        kind: reason.kind,
        reason: body.reason,
        note: body.note ?? null,
        points: reason.points, // همیشه از کاتالوگ سرور — override کلاینت قابل سوءاستفاده بود
        recordedById: me.id,
      },
    });
    // اعلان به دانش‌آموز و اولیا
    const title = reason.kind === "POSITIVE" ? "تشویق انضباطی" : "اخطار انضباطی";
    const cat = reason.kind === "POSITIVE" ? "SUCCESS" : "URGENT";
    await Promise.all([
      notifyUser(student.userId, cat, title, reason.label, `/app/behavior`),
      ...student.parents.map((p) =>
        notifyUser(p.parentUserId, cat, `${title} — ${student.user.firstName} ${student.user.lastName}`, reason.label, `/app/behavior`)
      ),
    ]);
    await audit({ user: me, action: "ثبت رکورد انضباطی", entityType: "BehaviorRecord", entityId: record.id, meta: { reason: body.reason, studentId: student.id } });
    return apiOk({ record });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/behavior?id= — حذف رکورد (مدیر به بالا) */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const rec = await db.behaviorRecord.findUnique({ where: { id } });
    if (!rec) return apiErr(404, "رکورد یافت نشد.", "NOT_FOUND");
    if (me.role !== "SUPER_ADMIN" && rec.schoolId !== me.schoolId) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }
    await db.behaviorRecord.delete({ where: { id } });
    await audit({ user: me, action: "حذف رکورد انضباطی", entityType: "BehaviorRecord", entityId: id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
