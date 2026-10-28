import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser , toInt } from "@/lib/api";
import { computeNextRun, runScheduledReport } from "@/lib/scheduler";

// ============================================================
// بهار | گزارش‌های زمان‌بندی‌شده — CRUD + اجرای فوری
// ============================================================

const KINDS: Record<string, string> = {
  DAILY_DIGEST: "خلاصه روزانه حضور و غیاب",
  ATTENDANCE_SUMMARY: "خلاصه هفتگی حضور و غیاب",
  RISK_DIGEST: "دانش‌آموزان در معرض خطر",
};

/** GET /api/reports/schedule */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = requireSchoolId(me);
    const reports = await db.scheduledReport.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
    });
    return apiOk({
      reports: reports.map((r) => ({
        id: r.id,
        kind: r.kind,
        kindLabel: KINDS[r.kind] ?? r.kind,
        schedule: r.schedule,
        dayOfWeek: r.dayOfWeek,
        hour: r.hour,
        audience: r.audience,
        active: r.active,
        lastRunAt: r.lastRunAt,
        nextRunAt: r.nextRunAt,
      })),
      kinds: Object.entries(KINDS).map(([k, v]) => ({ key: k, label: v })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/reports/schedule — { kind, schedule, dayOfWeek?, hour, audience } */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);    const body = await readJson<{ kind?: string; schedule?: string; dayOfWeek?: number; hour?: number; audience?: string }>(req);

    const kind = String(body.kind ?? "");
    if (!KINDS[kind]) return apiErr(400, "نوع گزارش نامعتبر است.", "BAD_KIND");
    const schedule = body.schedule === "DAILY" ? "DAILY" : "WEEKLY";
    const hour = toInt(body.hour ?? 8, 5, 22) ?? 8; // FIX راند ۱۶ — NaN نمی‌گذرد
    const dayOfWeek = schedule === "WEEKLY" ? Math.max(0, Math.min(6, Number(body.dayOfWeek ?? 0))) : null;
    const audience = body.audience === "TEACHERS" ? "TEACHERS" : "MANAGERS";

    const report = await db.scheduledReport.create({
      data: {
        schoolId, kind, schedule, dayOfWeek, hour, audience,
        createdBy: me.id,
        nextRunAt: computeNextRun({ schedule, dayOfWeek, hour }),
      },
    });
    await audit({ user: me, action: "ایجاد گزارش زمان‌بندی‌شده", entityType: "ScheduledReport", entityId: report.id, meta: { kind, schedule } });
    return apiOk({ report });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/reports/schedule — { id, active } یا { id, action: "run" } */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; active?: boolean; action?: string }>(req);
    const id = String(body.id ?? "");
    const report = await db.scheduledReport.findFirst({ where: { id, schoolId } });
    if (!report) return apiErr(404, "گزارش یافت نشد.", "NOT_FOUND");

    if (body.action === "run") {
      // اجرای فوری — فقط همین گزارشِ همین مدرسه (نه گزارش‌های سررسیدِ همه مدارس)
      const res = await runScheduledReport(report);
      await audit({ user: me, action: "اجرای فوری گزارش زمان‌بندی‌شده", entityId: id, meta: { notified: res.notified } });
      return apiOk({ ok: true, notified: res.notified, note: res.notified > 0 ? "اعلان ارسال شد." : "داده امروز موجود نیست؛ اعلانی ارسال نشد." });
    }

    const active = Boolean(body.active);
    const next = await db.scheduledReport.update({
      where: { id },
      data: { active, ...(active && !report.nextRunAt ? { nextRunAt: computeNextRun(report) } : {}) },
    });
    await audit({ user: me, action: active ? "فعال‌سازی گزارش زمان‌بندی‌شده" : "غیرفعال‌سازی گزارش زمان‌بندی‌شده", entityId: id });
    return apiOk({ report: next });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/reports/schedule?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return apiErr(400, "شناسه گزارش الزامی است.", "BAD_INPUT");
    const report = await db.scheduledReport.findFirst({ where: { id, schoolId } });
    if (!report) return apiErr(404, "گزارش یافت نشد.", "NOT_FOUND");
    await db.scheduledReport.delete({ where: { id } });
    await audit({ user: me, action: "حذف گزارش زمان‌بندی‌شده", entityId: id });
    return apiOk({ deleted: id });
  } catch (e) {
    return handleApiError(e);
  }
}
