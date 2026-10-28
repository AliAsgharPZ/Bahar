import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | حقوق و دستمزد — ثبت حقوق ماهانهٔ کارکنان (پایه +
   مزایا − کسورات = خالص)، فیش حقوقی قابل چاپ برای خود فرد و
   جدول مدیریتی ماه با جمع کل
   ============================================================ */

const STAFF_ROLES = ["TEACHER", "MANAGER", "DEPUTY", "CUSTODIAN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const month = new URL(req.url).searchParams.get("month") ?? "";

    // نمای فردی: فیش‌های خودم
    if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) {
      const mine = await db.salaryRecord.findMany({ where: { userId: me.id }, orderBy: { yearMonth: "desc" } });
      return apiOk({ mine });
    }

    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const staff = await db.user.findMany({
      where: { schoolId, role: { in: STAFF_ROLES }, isActive: true },
      select: { id: true, firstName: true, lastName: true, role: true },
      orderBy: { lastName: "asc" },
    });
    const records = month
      ? await db.salaryRecord.findMany({ where: { schoolId, yearMonth: month } })
      : [];
    const byUser = new Map<string, any>(records.map((r) => [r.userId, r]));
    const rows = staff.map((u) => {
      const r = byUser.get(u.id);
      return {
        user: u,
        record: r ? { ...r, net: r.base + r.allowances - r.deductions } : null,
      };
    });
    const totals = records.reduce(
      (t, r) => ({ base: t.base + r.base, allowances: t.allowances + r.allowances, deductions: t.deductions + r.deductions, net: t.net + r.base + r.allowances - r.deductions }),
      { base: 0, allowances: 0, deductions: 0, net: 0 },
    );
    return apiOk({ rows, totals });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ userId?: string; yearMonth?: string; base?: number; allowances?: number; deductions?: number; note?: string }>(req);
    const yearMonth = String(body.yearMonth ?? "");
    if (!/^\d{4}-\d{2}$/.test(yearMonth)) return apiErr(400, "ماه را مثل 1405-08 بنویسید.", "BAD_MONTH");
    const target = await db.user.findFirst({
      where: { id: String(body.userId ?? ""), schoolId, role: { in: STAFF_ROLES } },
      select: { id: true },
    });
    if (!target) return apiErr(404, "کارمند یافت نشد.", "NOT_FOUND");
    const money = (v: unknown) => Math.min(10_000_000_000, Math.max(0, Math.round(Number(v ?? 0)) || 0));
    const record = await db.salaryRecord.upsert({
      where: { userId_yearMonth: { userId: target.id, yearMonth } },
      create: {
        schoolId, userId: target.id, yearMonth,
        base: money(body.base), allowances: money(body.allowances), deductions: money(body.deductions),
        note: body.note?.trim().slice(0, 300) || null, createdById: me.id,
      },
      update: {
        base: money(body.base), allowances: money(body.allowances), deductions: money(body.deductions),
        note: body.note?.trim().slice(0, 300) || null,
      },
    });
    await audit({ user: me, action: "ثبت حقوق ماهانه", entityType: "SalaryRecord", entityId: record.id, schoolId });
    return apiOk({ record: { ...record, net: record.base + record.allowances - record.deductions } });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.salaryRecord.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.salaryRecord.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
