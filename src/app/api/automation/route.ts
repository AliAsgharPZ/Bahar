import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";

export const TRIGGERS: Record<string, string> = {
  ABSENT_THRESHOLD: "غیبت به آستانه مشخص برسد",
  LOW_ATTENDANCE: "درصد حضور زیر آستانه برود",
  GRADE_DROP: "افت نمره بیش از حد آستانه",
  FEE_OVERDUE: "شهریه سررسیدشده و پرداخت‌نشده",
  LEAVE_REQUEST: "درخواست مرخصی جدید ثبت شود",
  MEETING_REQUEST: "درخواست ملاقات جدید ثبت شود",
  BIRTHDAY: "تولد دانش‌آموز",
};

export const ACTIONS: Record<string, string> = {
  NOTIFY: "ارسال اعلان",
  TASK: "ایجاد تسک پیگیری",
  TAG: "افزودن تگ به دانش‌آموز",
};

/** GET /api/automation — قوانین + لاگ‌ها */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN", "DEPUTY"]);
    // FIX (راند ۱۸): acting-school — سوپرادمین داخل پنل مدرسه قوانین همان مدرسه را می‌بیند
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiOk({ rules: [], logs: [], triggers: TRIGGERS, actions: ACTIONS, noSchool: true });
    const [rules, logs] = await Promise.all([
      db.automationRule.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" } }),
      db.automationLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 50 }),
    ]);
    return apiOk({ rules, logs, triggers: TRIGGERS, actions: ACTIONS });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/automation — قانون جدید */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    // FIX (راند ۱۸): acting-school — سوپرادمین داخل پنل مدرسه می‌تواند قانون بسازد
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) {
      return apiErr(400, "کاربر به مدرسه‌ای متصل نیست. سوپرادمین باید ابتدا از صفحه «مدارس» وارد پنل یک مدرسه شود.", "NO_SCHOOL");
    }
    const body = await readJson<{
      name: string;
      trigger: string;
      config?: Record<string, unknown>;
      action: string;
      actionConfig?: Record<string, unknown>;
      active?: boolean;
    }>(req);
    if (!body.name?.trim() || !TRIGGERS[body.trigger] || !ACTIONS[body.action]) {
      return apiErr(400, "نام، تریگر و اکشن معتبر لازم است.", "BAD_REQUEST");
    }
    const rule = await db.automationRule.create({
      data: {
        schoolId,
        name: body.name.trim(),
        trigger: body.trigger,
        config: JSON.stringify(body.config ?? {}),
        action: body.action,
        actionConfig: JSON.stringify(body.actionConfig ?? {}),
        active: body.active ?? true,
      },
    });
    await audit({ user: me, action: "ایجاد قانون اتوماسیون", entityType: "AutomationRule", entityId: rule.id, schoolId, meta: { name: body.name } });
    return apiOk({ rule });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/automation — فعال/غیرفعال یا ویرایش */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ id: string; active?: boolean; name?: string; actionConfig?: Record<string, unknown>; config?: Record<string, unknown> }>(req);
    const rule = await db.automationRule.findUnique({ where: { id: body.id } });
    if (!rule) return apiErr(404, "قانون یافت نشد.", "NOT_FOUND");
    if (rule.schoolId !== me.schoolId && me.role !== "SUPER_ADMIN" && rule.schoolId !== actingSchoolIdFor(req, me)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const updated = await db.automationRule.update({
      where: { id: body.id },
      data: {
        ...(body.active !== undefined ? { active: body.active } : {}),
        ...(body.name?.trim() ? { name: body.name.trim() } : {}),
        ...(body.config ? { config: JSON.stringify(body.config) } : {}),
        ...(body.actionConfig ? { actionConfig: JSON.stringify(body.actionConfig) } : {}),
      },
    });
    await audit({ user: me, action: "ویرایش قانون اتوماسیون", entityType: "AutomationRule", entityId: body.id });
    return apiOk({ rule: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/automation?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const rule = await db.automationRule.findUnique({ where: { id } });
    if (!rule) return apiErr(404, "قانون یافت نشد.", "NOT_FOUND");
    if (rule.schoolId !== me.schoolId && me.role !== "SUPER_ADMIN" && rule.schoolId !== actingSchoolIdFor(req, me)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.automationRule.delete({ where: { id } });
    await audit({ user: me, action: "حذف قانون اتوماسیون", entityType: "AutomationRule", entityId: id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
