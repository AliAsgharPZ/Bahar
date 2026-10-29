import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | تعادل تکالیف — ابزار فقط‌خواندنی روی دادهٔ واقعی
   تکالیف یک کلاس را در هفته‌های آینده می‌شمارد و هفته‌های پرتراکم
   (بیش از ۵ تکلیف در هفته، یا بیش از ۲ تکلیف با یک مهلت) را پرچم
   می‌زند و سبک‌ترین هفته را برای جابه‌جایی پیشنهاد می‌دهد.
   هیچ داده‌ای را تغییر نمی‌دهد.
   ============================================================ */

const OVERLOAD_WEEK = 5;
const OVERLOAD_DAY = 2;

function weekBuckets(from: Date, weeks: number): { start: Date; end: Date; label: string }[] {
  const out: { start: Date; end: Date; label: string }[] = [];
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  for (let i = 0; i < weeks; i++) {
    const start = new Date(base.getTime() + i * 7 * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    const fmt = (d: Date) => `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    out.push({ start, end, label: `هفتهٔ ${i + 1} (${fmt(start)} تا ${fmt(end)})` });
  }
  return out;
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const q = new URL(req.url).searchParams;
    const weeks = Math.min(8, Math.max(1, Number(q.get("weeks") ?? 4) || 4));

    let classId = q.get("classId") ?? "";
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
      if (!profile?.classId) return apiOk({ weeks: [], summary: { total: 0, overloadWeeks: 0, lightestWeek: null } });
      classId = profile.classId;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, include: { student: { select: { classId: true } } } });
      if (!link?.student.classId) return apiOk({ weeks: [], summary: { total: 0, overloadWeeks: 0, lightestWeek: null } });
      classId = link.student.classId;
    }
    if (!classId) {
      const first = await db.class.findFirst({ where: { schoolId, isActive: true }, orderBy: { name: "asc" }, select: { id: true } });
      if (!first) return apiOk({ weeks: [], summary: { total: 0, overloadWeeks: 0, lightestWeek: null } });
      classId = first.id;
    }
    const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true, name: true } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    const now = new Date();
    const horizon = new Date(now.getTime() + weeks * 7 * 86400000);
    const rows = await db.assignment.findMany({
      where: { classId, dueDate: { gte: now, lte: horizon } },
      include: { subject: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
    });

    const buckets = weekBuckets(now, weeks);
    const weekData = buckets.map((b) => {
      const inWeek = rows.filter((r) => r.dueDate >= b.start && r.dueDate <= new Date(b.end.getTime() + 86400000 - 1));
      const bySubject: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      for (const r of inWeek) {
        const s = r.subject?.name ?? "بدون درس";
        bySubject[s] = (bySubject[s] ?? 0) + 1;
        const d = r.dueDate.toISOString().slice(0, 10);
        byDay[d] = (byDay[d] ?? 0) + 1;
      }
      const pileups = Object.entries(byDay).filter(([, c]) => c > OVERLOAD_DAY).map(([d, c]) => ({ date: d, count: c }));
      return {
        label: b.label, count: inWeek.length,
        overload: inWeek.length > OVERLOAD_WEEK || pileups.length > 0,
        bySubject: Object.entries(bySubject).map(([name, count]) => ({ name, count })),
        pileups,
        items: inWeek.map((r) => ({ id: r.id, title: r.title, subject: r.subject?.name ?? "بدون درس", dueDate: r.dueDate.toISOString() })),
      };
    });

    const total = rows.length;
    const overloadWeeks = weekData.filter((w) => w.overload).length;
    const lightest = weekData.reduce((min, w) => (w.count < min.count ? w : min), weekData[0]);
    return apiOk({
      class: cls,
      weeks: weekData,
      summary: {
        total, overloadWeeks,
        lightestWeek: lightest ? { label: lightest.label, count: lightest.count } : null,
        suggestion: overloadWeeks > 0 && lightest
          ? `هفته‌های پرتراکم را سبک کنید: انتقال یک تکلیف به ${lightest.label} (اکنون ${lightest.count} تکلیف) تراکم را کم می‌کند.`
          : "تراکم تکالیف در هفته‌های آینده متعادل است.",
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
