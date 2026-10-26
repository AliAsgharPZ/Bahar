import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | کامنت کارنامه — بانک عبارات فارسی + پیش‌نویس خودکار
   از دادهٔ واقعی دانش‌آموز (روند نمره، حضور، رفتار) که معلم
   بازبینی و ویرایش می‌کند و برای هر ترم ذخیره می‌شود.
   پیش‌نویس کاملاً قاعده‌محور است (بدون هوش مصنوعی بیرونی) تا
   نام، جنسیت و اعداد اشتباه وارد متن نشود.
   ============================================================ */

const STAFF = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

async function buildDraft(studentId: string): Promise<string> {
  const st = await db.student.findUnique({
    where: { id: studentId },
    include: { user: { select: { firstName: true, lastName: true, gender: true } } },
  });
  if (!st) return "";
  const name = st.user.firstName;
  const isGirl = st.user.gender === "FEMALE";
  const son = isGirl ? "دخترم" : "پسرم";

  const grades = await db.gradeRecord.findMany({
    where: { studentId },
    orderBy: { createdAt: "asc" },
    select: { score: true, maxScore: true },
  });
  const norm = grades.map((g) => (g.maxScore > 0 ? (g.score / g.maxScore) * 20 : g.score));
  const avg = norm.length ? norm.reduce((s, v) => s + v, 0) / norm.length : null;
  const half = Math.floor(norm.length / 2);
  const early = half ? norm.slice(0, half).reduce((s, v) => s + v, 0) / Math.max(1, half) : null;
  const late = norm.length - half ? norm.slice(half).reduce((s, v) => s + v, 0) / Math.max(1, norm.length - half) : null;
  const trend = early !== null && late !== null ? late - early : 0;

  const att = await db.attendance.findMany({ where: { studentId }, select: { status: true } });
  const attRate = att.length
    ? Math.round((att.filter((a) => a.status === "PRESENT" || a.status === "LATE").length / att.length) * 100)
    : null;

  const behavior = await db.behaviorRecord.findMany({ where: { studentId }, select: { kind: true, points: true } });
  const positives = behavior.filter((b) => b.kind === "POSITIVE").length;

  const parts: string[] = [];
  if (avg === null) {
    parts.push(`${name} ${son} در این ترم هنوز نمرهٔ ثبت‌شده‌ای ندارد؛ ارزیابی کیفی او بر اساس فعالیت کلاسی انجام شده است.`);
  } else if (avg >= 17) {
    parts.push(`${name} ${son} در این ترم عملکردی درخشان داشت و با میانگین ${avg.toFixed(1)} در جمع بهترین‌های کلاس قرار گرفت.`);
  } else if (avg >= 14) {
    parts.push(`${name} ${son} در این ترم عملکرد خوبی داشت و با میانگین ${avg.toFixed(1)} بیشتر درس‌ها را با موفقیت پشت سر گذاشت.`);
  } else if (avg >= 11) {
    parts.push(`${name} ${son} در این ترم با میانگین ${avg.toFixed(1)} عملکردی متوسط داشت و با کمی تلاش بیشتر می‌تواند به نتایج بهتری برسد.`);
  } else {
    parts.push(`${name} ${son} در این ترم با میانگین ${avg.toFixed(1)} نیازمند توجه و تلاش بیشتری است؛ همراهی خانواده و پیگیری مستمر به پیشرفت او کمک می‌کند.`);
  }
  if (norm.length >= 4) {
    if (trend >= 1) parts.push("روند نمرات او در طول ترم صعودی بوده و این پیشرفت شایستهٔ تقدیر است.");
    else if (trend <= -1) parts.push("روند نمرات او در نیمهٔ دوم ترم افت داشته است؛ بررسی علت و جبران آن در ترم آینده توصیه می‌شود.");
  }
  if (attRate !== null) {
    if (attRate >= 95) parts.push("حضور او در کلاس منظم و بدون غیبت قابل‌توجه بوده است.");
    else if (attRate < 85) parts.push(`حضور او در کلاس (${attRate}٪) نیازمند توجه است؛ غیبت‌ها بر یادگیری او اثر می‌گذارد.`);
  }
  if (positives >= 3) parts.push("از نظر رفتاری نیز نمونه بوده و چندین بار بابت همکاری و مسئولیت‌پذیری تشویق شده است.");
  parts.push("برای او آرزوی موفقیت و سلامتی دارم.");
  return parts.join(" ");
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
    const templates = await db.reportCommentTemplate.findMany({
      where: { schoolId },
      orderBy: { createdAt: "asc" },
    });
    const out: Record<string, unknown> = { templates };
    if (studentId) {
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const [saved, draft] = await Promise.all([
        db.reportComment.findMany({ where: { studentId }, orderBy: { term: "asc" } }),
        buildDraft(studentId),
      ]);
      out.saved = saved;
      out.draft = draft;
    }
    return apiOk(out);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ action?: string; id?: string; category?: string; text?: string; studentId?: string; term?: number }>(req);

    if (body.action === "saveTemplate") {
      const text = (body.text ?? "").trim();
      if (text.length < 5) return apiErr(400, "متن عبارت کوتاه است.", "BAD_INPUT");
      const t = await db.reportCommentTemplate.create({
        data: { schoolId, category: body.category ?? "GENERAL", text: text.slice(0, 500), createdById: me.id },
      });
      return apiOk({ template: t });
    }
    if (body.action === "deleteTemplate") {
      await db.reportCommentTemplate.deleteMany({ where: { id: String(body.id ?? ""), schoolId } });
      return apiOk({ ok: true });
    }
    if (body.action === "saveComment") {
      const studentId = String(body.studentId ?? "");
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const term = [1, 2].includes(Number(body.term)) ? Number(body.term) : 1;
      const text = (body.text ?? "").trim().slice(0, 2000);
      if (text.length < 5) return apiErr(400, "متن کامنت کوتاه است.", "BAD_INPUT");
      const existing = await db.reportComment.findFirst({ where: { studentId, term, createdById: me.id } });
      const saved = existing
        ? await db.reportComment.update({ where: { id: existing.id }, data: { text } })
        : await db.reportComment.create({ data: { schoolId, studentId, term, text, createdById: me.id } });
      await audit({ user: me, action: "ذخیره کامنت کارنامه", entityType: "ReportComment", entityId: saved.id, schoolId });
      return apiOk({ comment: saved });
    }
    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
