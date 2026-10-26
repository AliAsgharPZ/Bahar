import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError } from "@/lib/api";
import { jalaliParts, JALALI_MONTHS, faDigits } from "@/lib/persian";

/**
 * GET /api/grades/monthly?studentId=
 * کارنامه ماهانه — خلاصه هر ماه شمسی: میانگین نمرات، حضور/غیبت، تعداد تکالیف
 * (دانش‌آموز خودش / ولی فرزندش / کارکنان مدرسه)
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    let studentId = searchParams.get("studentId");

    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
      studentId = profile?.id ?? null;
    } else if (me.role === "PARENT") {
      if (studentId) {
        const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
        if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      } else {
        const children = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
        studentId = children[0]?.studentId ?? null;
      }
    } else if (!studentId) {
      return apiErr(400, "دانش‌آموز را مشخص کنید.", "BAD_INPUT");
    }

    if (!studentId) return apiOk({ months: [], student: null });

    const student = await db.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true } },
        class: { select: { name: true, schoolId: true } },
      },
    });
    if (!student) return apiOk({ months: [], student: null });

    // اجازه کارکنان: باید هم‌مدرسه باشد (کارمند بدون مدرسه هم مدرسه محسوب نمی‌شود)
    if (["MANAGER", "DEPUTY", "TEACHER", "ADMIN"].includes(me.role)) {
      if (!me.schoolId || student.class?.schoolId !== me.schoolId) {
        return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
      }
    }

    const [grades, attendance, assignments] = await Promise.all([
      db.gradeRecord.findMany({
        where: { studentId },
        select: { score: true, maxScore: true, weight: true, createdAt: true },
      }),
      db.attendance.findMany({
        where: { studentId },
        select: { date: true, status: true },
      }),
      db.assignment.findMany({
        where: { class: { students: { some: { id: studentId } } } },
        select: { createdAt: true },
      }),
    ]);

    type MonthAgg = {
      key: string;
      year: number;
      month: number;
      monthName: string;
      gradeCount: number;
      gradeSum: number; // نمره نرمال‌شده به ۲۰ (با وزن)
      weightSum: number; // مجموع وزن‌ها برای میانگین درست
      present: number;
      absent: number;
      late: number;
      excused: number;
      assignmentCount: number;
    };
    const months = new Map<string, MonthAgg>();

    const enNum = (s: string): number => Number(String(s).replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d))));

    const bucketOf = (y: number, m: number): MonthAgg => {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      let b = months.get(key);
      if (!b) {
        b = {
          key, year: y, month: m, monthName: JALALI_MONTHS[m - 1] ?? "",
          gradeCount: 0, gradeSum: 0, weightSum: 0, present: 0, absent: 0, late: 0, excused: 0, assignmentCount: 0,
        };
        months.set(key, b);
      }
      return b;
    };

    for (const g of grades) {
      const p = jalaliParts(g.createdAt);
      const b = bucketOf(p.y, p.m);
      b.gradeCount += 1;
      b.gradeSum += (g.score / Math.max(1, g.maxScore)) * 20 * (g.weight || 1);
      b.weightSum += g.weight || 1;
    }
    for (const a of attendance) {
      const m = /^(\d{4})-(\d{2})/.exec(a.date);
      if (!m) continue;
      const b = bucketOf(enNum(m[1]), enNum(m[2]));
      if (a.status === "PRESENT") b.present += 1;
      else if (a.status === "ABSENT") b.absent += 1;
      else if (a.status === "LATE") b.late += 1;
      else if (a.status === "EXCUSED") b.excused += 1;
    }
    for (const a of assignments) {
      const p = jalaliParts(a.createdAt);
      const b = bucketOf(p.y, p.m);
      b.assignmentCount += 1;
    }

    const list = [...months.values()]
      .sort((x, y) => (x.year !== y.year ? y.year - x.year : y.month - x.month))
      .map((b) => {
        const totalDays = b.present + b.absent + b.late + b.excused;
        return {
          key: b.key,
          year: b.year,
          month: b.month,
          monthName: b.monthName,
          title: `${b.monthName} ${faDigits(b.year)}`,
          gradeCount: b.gradeCount,
          avg: b.gradeCount ? +(b.gradeSum / Math.max(1e-9, b.weightSum)).toFixed(2) : null,
          present: b.present,
          absent: b.absent,
          late: b.late,
          excused: b.excused,
          attendanceRate: totalDays > 0 ? Math.round((b.present / totalDays) * 100) : null,
          assignmentCount: b.assignmentCount,
        };
      });

    return apiOk({
      months: list,
      student: {
        name: `${student.user.firstName} ${student.user.lastName}`,
        className: student.class?.name ?? null,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
