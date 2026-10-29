import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | گروه‌های مطالعه — پیشنهاد گروه‌بندی متوازن روی دادهٔ واقعی
   دانش‌آموزان یک کلاس بر اساس میانگین نمره (درس انتخاب‌شده یا کل
   درس‌ها) به روش مارپیچ (snake draft) در گروه‌هایی با اندازهٔ
   مشخص پخش می‌شوند تا هر گروه ترکیبی از قوی و ضعیف باشد.
   گروه‌ها فقط پیشنهادند و ذخیره نمی‌شوند؛ هیچ داده‌ای تغییر نمی‌کند.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const q = new URL(req.url).searchParams;
    const size = Math.min(8, Math.max(2, Number(q.get("size") ?? 4) || 4));
    const subjectId = q.get("subjectId") ?? "";

    let classId = q.get("classId") ?? "";
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
      if (!profile?.classId) return apiOk({ groups: [], ungraded: 0 });
      classId = profile.classId;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, include: { student: { select: { classId: true } } } });
      if (!link?.student.classId) return apiOk({ groups: [], ungraded: 0 });
      classId = link.student.classId;
    }
    if (!classId) {
      const first = await db.class.findFirst({ where: { schoolId, isActive: true }, orderBy: { name: "asc" }, select: { id: true } });
      if (!first) return apiOk({ groups: [], ungraded: 0 });
      classId = first.id;
    }
    const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    const students = await db.student.findMany({
      where: { classId, schoolId, status: "ACTIVE" },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { studentNumber: "asc" },
    });
    const ids = students.map((s) => s.id);
    const grades = await db.gradeRecord.findMany({
      where: { studentId: { in: ids }, ...(subjectId ? { subjectId } : {}) },
      select: { studentId: true, score: true, maxScore: true, weight: true },
    });
    const agg = new Map<string, { sum: number; w: number }>();
    for (const g of grades) {
      const cur = agg.get(g.studentId) ?? { sum: 0, w: 0 };
      const max = g.maxScore > 0 ? g.maxScore : 20;
      cur.sum += (g.score / max) * 100 * (g.weight || 1);
      cur.w += g.weight || 1;
      agg.set(g.studentId, cur);
    }
    const withAvg = students.map((s) => {
      const a = agg.get(s.id);
      return {
        id: s.id,
        name: `${s.user.firstName} ${s.user.lastName}`,
        avg: a && a.w > 0 ? Math.round((a.sum / a.w) * 10) / 10 : null,
      };
    });
    const graded = withAvg.filter((s) => s.avg !== null).sort((a, b) => (b.avg ?? 0) - (a.avg ?? 0));
    const ungraded = withAvg.filter((s) => s.avg === null);
    // مارپیچ: رفت‌وبرگشت در گروه‌ها تا میانگین گروه‌ها نزدیک هم شود
    const groupCount = Math.max(1, Math.ceil(withAvg.length / size));
    const groups: { members: typeof withAvg; avg: number | null }[] = Array.from({ length: groupCount }, () => ({ members: [], avg: null }));
    const ordered = [...graded, ...ungraded];
    let gi = 0;
    let dir = 1;
    for (const st of ordered) {
      groups[gi].members.push(st);
      if (dir === 1) {
        if (gi === groupCount - 1) dir = -1;
        else gi++;
      } else {
        if (gi === 0) dir = 1;
        else gi--;
      }
    }
    for (const g of groups) {
      const avgs = g.members.map((m) => m.avg).filter((a): a is number => a !== null);
      g.avg = avgs.length ? Math.round((avgs.reduce((s, a) => s + a, 0) / avgs.length) * 10) / 10 : null;
    }
    let subjectName: string | null = null;
    if (subjectId) {
      const subj = await db.subject.findFirst({ where: { id: subjectId, schoolId }, select: { name: true } });
      subjectName = subj?.name ?? null;
    }
    return apiOk({
      class: cls, subject: subjectName, size,
      groups: groups.filter((g) => g.members.length > 0),
      ungraded: ungraded.length,
      note: "گروه‌ها پیشنهاد متوازن بر اساس میانگین نمره‌اند و ذخیره نمی‌شوند؛ معلم می‌تواند ترکیب را دستی تغییر دهد.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
