import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError } from "@/lib/api";

/* ============================================================
   بهار | داشبورد شبکه (EMIS) — نمای تجمیعی بالای سلسله‌مراتب
   برای سوپرادمین/ادمین پلتفرم: هر مدرسه با تعداد دانش‌آموز،
   کادر، کلاس، لیدهای پذیرش و جمع کل شبکه در یک جدول.
   ============================================================ */

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["SUPER_ADMIN", "ADMIN"]);
    const schools = await db.school.findMany({
      select: { id: true, name: true, code: true, city: true, province: true, isActive: true },
      orderBy: { name: "asc" },
    });
    const rows = await Promise.all(schools.map(async (s) => {
      const [students, staff, classes, leads, feesPaid] = await Promise.all([
        db.student.count({ where: { schoolId: s.id, status: "ACTIVE" } }),
        db.user.count({ where: { schoolId: s.id, role: { in: ["TEACHER", "MANAGER", "DEPUTY", "CUSTODIAN"] }, isActive: true } }),
        db.class.count({ where: { schoolId: s.id } }),
        db.schoolLead.count({ where: { schoolId: s.id } }),
        db.studentFee.aggregate({ where: { schoolId: s.id, status: "PAID" }, _sum: { amount: true } }),
      ]);
      return {
        ...s, students, staff, classes, leads,
        feesPaid: feesPaid._sum.amount ?? 0,
        ratio: staff > 0 ? Math.round((students / staff) * 10) / 10 : 0,
      };
    }));
    const totals = rows.reduce(
      (t, r) => ({
        schools: t.schools + 1, students: t.students + r.students,
        staff: t.staff + r.staff, classes: t.classes + r.classes,
        leads: t.leads + r.leads, feesPaid: t.feesPaid + r.feesPaid,
      }),
      { schools: 0, students: 0, staff: 0, classes: 0, leads: 0, feesPaid: 0 },
    );
    return apiOk({ schools: rows, totals });
  } catch (e) {
    return handleApiError(e);
  }
}
