import { currencyLabel } from "@/lib/persian";
import { db } from "@/lib/db";
import { notifyUser } from "@/lib/notify";

/* ============================================================
   بهار | موتور اتوماسیون — تریگر/اکشن سبک
   قوانین شرطی مدرسه؛ هر رخداد (ثبت غیبت/افت نمره/…) موتور را
   صدا می‌زند. بدون صف/کارگر — اجرای همان لحظه با try/catch.
   ============================================================ */

export type AutoEvent =
  | { type: "ABSENT_THRESHOLD"; schoolId: string; studentId: string; studentName: string; absences: number; classId?: string }
  | { type: "LOW_ATTENDANCE"; schoolId: string; studentId: string; studentName: string; rate: number }
  | { type: "GRADE_DROP"; schoolId: string; studentId: string; studentName: string; subjectName: string; drop: number }
  | { type: "FEE_OVERDUE"; schoolId: string; studentId: string; studentName: string; amount: number }
  | { type: "LEAVE_REQUEST"; schoolId: string; requesterName: string; leaveId: string }
  | { type: "MEETING_REQUEST"; schoolId: string; requesterName: string; meetingId: string }
  | { type: "BIRTHDAY"; schoolId: string; studentId: string; studentName: string };

/** اجرای قوانین فعال مدرسه برای یک رخداد */
export async function runAutomations(ev: AutoEvent): Promise<void> {
  try {
    const rules = await db.automationRule.findMany({
      where: { schoolId: ev.schoolId, active: true, trigger: ev.type },
    });
    if (!rules.length) return;

    for (const rule of rules) {
      const config = JSON.parse(rule.config || "{}") as Record<string, unknown>;
      const actionConfig = JSON.parse(rule.actionConfig || "{}") as Record<string, unknown>;

      // شرط آستانه
      let pass = true;
      if (ev.type === "ABSENT_THRESHOLD" && typeof config.threshold === "number") pass = ev.absences >= config.threshold;
      if (ev.type === "LOW_ATTENDANCE" && typeof config.threshold === "number") pass = ev.rate < config.threshold;
      if (ev.type === "GRADE_DROP" && typeof config.threshold === "number") pass = ev.drop >= config.threshold;
      if (!pass) continue;

      let result = "DONE";
      let summary = "";
      try {
        if (rule.action === "NOTIFY") {
          // هدف: MANAGER (پیش‌فرض) / DEPUTY / TEACHERS / PARENTS_OF_STUDENT
          const target = (actionConfig.target as string) ?? "MANAGER";
          let userIds: string[] = [];
          if (target === "PARENTS_OF_STUDENT" && "studentId" in ev) {
            const parents = await db.studentParent.findMany({ where: { studentId: ev.studentId }, select: { parentUserId: true } });
            userIds = parents.map((p) => p.parentUserId);
          } else if (target === "TEACHERS") {
            const ts = await db.user.findMany({ where: { schoolId: ev.schoolId, role: "TEACHER", isActive: true }, select: { id: true } });
            userIds = ts.map((t) => t.id);
          } else {
            const role = target === "DEPUTY" ? "DEPUTY" : "MANAGER";
            const mgr = await db.school.findUnique({ where: { id: ev.schoolId }, select: { managerId: true } });
            const users = await db.user.findMany({ where: { schoolId: ev.schoolId, role, isActive: true }, select: { id: true } });
            userIds = users.map((u) => u.id);
            if (role === "MANAGER" && mgr?.managerId) userIds = [mgr.managerId, ...userIds.filter((u) => u !== mgr.managerId)];
          }
          const title = (actionConfig.title as string) ?? rule.name;
          const body = summaryText(ev);
          await notifyManySafe(userIds, config.category === "URGENT" ? "URGENT" : config.category === "IMPORTANT" ? "IMPORTANT" : "INFO", title, body, "/app/action-center");
          summary = `اعلان به ${userIds.length} کاربر ارسال شد`;
        } else if (rule.action === "TASK") {
          const exists = await db.task.findFirst({
            where: { schoolId: ev.schoolId, sourceKind: "AUTOMATION", sourceId: rule.id + ":" + evKey(ev), status: { in: ["TODO", "IN_PROGRESS"] } },
          });
          if (!exists) {
            await db.task.create({
              data: {
                schoolId: ev.schoolId,
                title: (actionConfig.title as string) ?? `پیگیری: ${shortOf(ev)}`,
                description: summaryText(ev),
                priority: (actionConfig.priority as string) ?? "HIGH",
                sourceKind: "AUTOMATION",
                sourceId: rule.id + ":" + evKey(ev),
                studentId: "studentId" in ev ? ev.studentId : null,
                classId: "classId" in ev ? ev.classId ?? null : null,
              },
            });
            summary = "تسک پیگیری ساخته شد";
          } else {
            result = "SKIPPED";
            summary = "تسک تکراری — از قبل موجود است";
          }
        } else if (rule.action === "TAG" && "studentId" in ev) {
          const tagKey = (actionConfig.tag as string) ?? "needs_followup";
          const st = await db.student.findUnique({ where: { id: ev.studentId }, select: { tags: true } });
          if (st) {
            const tags = JSON.parse(st.tags || "[]") as string[];
            if (!tags.includes(tagKey)) {
              tags.push(tagKey);
              await db.student.update({ where: { id: ev.studentId }, data: { tags: JSON.stringify(tags) } });
              summary = `تگ «${tagKey}» به دانش‌آموز افزوده شد`;
            } else {
              result = "SKIPPED";
              summary = "تگ از قبل موجود بود";
            }
          }
        }
      } catch (e) {
        result = "ERROR";
        summary = e instanceof Error ? e.message : "خطا";
      }

      await db.$transaction([
        db.automationLog.create({
          data: { ruleId: rule.id, schoolId: ev.schoolId, trigger: ev.type, summary, result, detail: JSON.stringify(ev).slice(0, 500) },
        }),
        db.automationRule.update({
          where: { id: rule.id },
          data: { runCount: { increment: 1 }, lastRunAt: new Date() },
        }),
      ]);
    }
  } catch (e) {
    console.error("[AUTOMATION]", e);
  }
}

async function notifyManySafe(userIds: string[], category: "URGENT" | "IMPORTANT" | "INFO", title: string, body: string, link: string) {
  const { notifyMany } = await import("@/lib/notify");
  await notifyMany(userIds, category, title, body, link);
}

function evKey(ev: AutoEvent): string {
  if ("studentId" in ev) return ev.type + ":" + ev.studentId;
  if ("leaveId" in ev) return "leave:" + ev.leaveId;
  if ("meetingId" in ev) return "meeting:" + ev.meetingId;
  return "unknown";
}

function shortOf(ev: AutoEvent): string {
  switch (ev.type) {
    case "ABSENT_THRESHOLD": return `غیبت مکرر — ${ev.studentName}`;
    case "LOW_ATTENDANCE": return `حضور پایین — ${ev.studentName}`;
    case "GRADE_DROP": return `افت نمره ${ev.subjectName} — ${ev.studentName}`;
    case "FEE_OVERDUE": return `شهریه معوق — ${ev.studentName}`;
    case "BIRTHDAY": return `تولد ${ev.studentName}`;
    default: return ev.type;
  }
}

function summaryText(ev: AutoEvent): string {
  switch (ev.type) {
    case "ABSENT_THRESHOLD": return `دانش‌آموز ${ev.studentName} به ${ev.absences} غیبت رسیده است؛ بررسی و تماس با خانواده توصیه می‌شود.`;
    case "LOW_ATTENDANCE": return `درصد حضور ${ev.studentName} به ${ev.rate}٪ رسیده است.`;
    case "GRADE_DROP": return `${ev.studentName} در ${ev.subjectName} افت ${ev.drop} نمره‌ای داشته است.`;
    case "FEE_OVERDUE": return `بدهی شهریه ${ev.studentName}: ${ev.amount.toLocaleString("fa-IR")} ${currencyLabel()}.`;
    case "LEAVE_REQUEST": return `درخواست مرخصی جدید از ${ev.requesterName}.`;
    case "MEETING_REQUEST": return `درخواست ملاقات جدید از ${ev.requesterName}.`;
    case "BIRTHDAY": return `امروز تولد ${ev.studentName} است!`;
    default: return ev satisfies never;
  }
}
