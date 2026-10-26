import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor, toDate } from "@/lib/api";

/* ============================================================
   بهار | مشارکت — نظرسنجی‌ها و صندوق پیشنهاد
   ============================================================ */

/** GET /api/engagement?tab=polls|suggestions */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    // FIX (راند ۱۸): سوپرادمین/ادمین داخل پنل مدرسه هم نظرسنجی‌ها را می‌بینند (acting school)
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    const tab = new URL(req.url).searchParams.get("tab") ?? "polls";
    if (!schoolId) return apiOk({ tab, polls: [], suggestions: [], canManage: false, noSchool: true });

    if (tab === "polls") {
      const polls = await db.poll.findMany({
        where: { schoolId },
        orderBy: { createdAt: "desc" },
        include: {
          options: { include: { _count: { select: { votes: true } } }, orderBy: { sortOrder: "asc" } },
          votes: { where: { userId: me.id }, select: { optionId: true } },
          _count: { select: { votes: true } },
        },
        take: 40,
      });
      return apiOk({
        tab,
        polls: polls.map((p) => ({
          id: p.id, question: p.question, description: p.description, audience: p.audience,
          allowMultiple: p.allowMultiple, anonymous: p.anonymous, active: p.active, closesAt: p.closesAt, createdAt: p.createdAt,
          totalVotes: p._count.votes,
          myVotes: p.votes.map((v) => v.optionId),
          options: p.options.map((o) => ({ id: o.id, text: o.text, votes: o._count.votes })),
        })),
        canManage: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role),
      });
    }

    // suggestions
    const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    const suggestions = await db.suggestion.findMany({
      where: isManager ? { schoolId } : { schoolId, OR: [{ userId: me.id }, { userId: null }] },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return apiOk({ tab, suggestions: isManager ? suggestions : suggestions.map((s) => ({ ...s, userId: s.userId ? "کاربر" : null })), canManage: isManager });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/engagement — ساخت نظرسنجی / رأی / پیشنهاد */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    // FIX (راند ۱۸): acting-school — سوپرادمین داخل پنل مدرسه می‌تواند نظرسنجی بسازد
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) {
      return apiErr(400, "کاربر به مدرسه‌ای متصل نیست. سوپرادمین/ادمین باید ابتدا از صفحه «مدارس» وارد پنل یک مدرسه شود.", "NO_SCHOOL");
    }
    const body = await readJson<Record<string, unknown>>(req);
    const action = String(body.action ?? "");

    if (action === "create-poll") {
      if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "فقط مدیریت می‌تواند نظرسنجی بسازد.", "FORBIDDEN");
      const question = String(body.question ?? "").trim();
      const options = (body.options as string[] | undefined)?.map((o) => String(o).trim()).filter(Boolean) ?? [];
      if (!question || options.length < 2) return apiErr(400, "سؤال و حداقل ۲ گزینه لازم است.", "BAD_REQUEST");
      const poll = await db.poll.create({
        data: {
          schoolId,
          question,
          description: (body.description as string) ?? null,
          audience: ["ALL", "STUDENTS", "PARENTS", "TEACHERS", "STAFF"].includes(String(body.audience)) ? String(body.audience) : "ALL",
          allowMultiple: body.allowMultiple === true,
          anonymous: body.anonymous !== false,
          closesAt: (() => { const d = body.closesAt ? toDate(body.closesAt) : null; return d; })(), // FIX راند ۱۶ — null if invalid
          createdById: me.id,
          options: { create: options.map((text, i) => ({ text, sortOrder: i })) },
        },
        include: { options: true },
      });
      await audit({ user: me, action: "ایجاد نظرسنجی", entityType: "Poll", entityId: poll.id, schoolId });
      return apiOk({ poll });
    }

    if (action === "vote") {
      const pollId = String(body.pollId ?? "");
      const optionIds = (body.optionIds as string[] | undefined) ?? [];
      const poll = await db.poll.findUnique({ where: { id: pollId }, include: { options: true } });
      if (!poll || poll.schoolId !== schoolId) return apiErr(404, "نظرسنجی یافت نشد.", "NOT_FOUND");
      if (!poll.active) return apiErr(400, "این نظرسنجی بسته شده است.", "CLOSED");
      if (poll.closesAt && poll.closesAt < new Date()) return apiErr(400, "زمان نظرسنجی تمام شده است.", "CLOSED");
      // مخاطب — سرایدار هم کارکنان است (راند ۱۸)
      const roleMap: Record<string, string[]> = {
        ALL: ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "STUDENT", "PARENT", "SUPER_ADMIN", "ADMIN"],
        STUDENTS: ["STUDENT"], PARENTS: ["PARENT"], TEACHERS: ["TEACHER"],
        STAFF: ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"],
      };
      if (!roleMap[poll.audience]?.includes(me.role)) return apiErr(403, "این نظرسنجی برای نقش شما نیست.", "FORBIDDEN");
      const existing = await db.pollVote.findFirst({ where: { pollId, userId: me.id } });
      if (existing && !poll.allowMultiple) return apiErr(409, "رأی شما قبلاً ثبت شده است.", "ALREADY_VOTED");
      // FIX (راند ۱۶): حذف گزینه‌های تکراری + تک‌انتخابی نباید چند گزینه بپذیرد
      if (!poll.allowMultiple && optionIds.length > 1) {
        return apiErr(400, "این نظرسنجی تک‌گزینه‌ای است.", "SINGLE_CHOICE");
      }
      const valid = [...new Set(optionIds)].filter((oid) => poll.options.some((o) => o.id === oid));
      if (!valid.length) return apiErr(400, "گزینه نامعتبر.", "BAD_OPTION");
      if (existing) await db.pollVote.deleteMany({ where: { pollId, userId: me.id } });
      await db.pollVote.createMany({ data: valid.map((optionId) => ({ pollId, optionId, userId: me.id })) });
      await audit({ user: me, action: "ثبت رأی", entityType: "Poll", entityId: pollId, schoolId, meta: { options: valid.length } });
      return apiOk({ ok: true });
    }

    if (action === "suggest") {
      const text = String(body.body ?? "").trim();
      if (text.length < 10) return apiErr(400, "متن پیشنهاد حداقل ۱۰ نویسه باشد.", "TOO_SHORT");
      if (!rateLimitSuggest(me.id)) return apiErr(429, "در این دقیقه چند پیشنهاد فرستاده‌اید؛ کمی صبر کنید.", "RATE");
      const anonymous = body.anonymous === true;
      const s = await db.suggestion.create({
        data: {
          schoolId,
          userId: anonymous ? null : me.id,
          authorName: anonymous ? null : `${me.firstName} ${me.lastName}`,
          body: text,
          category: ["FACILITIES", "EDUCATION", "FOOD", "SERVICE", "OTHER"].includes(String(body.category)) ? String(body.category) : "OTHER",
        },
      });
      await audit({ user: me, action: "ثبت پیشنهاد", entityType: "Suggestion", entityId: s.id, schoolId, meta: { anonymous } });
      return apiOk({ suggestion: anonymous ? { ...s, userId: null } : s });
    }

    if (action === "review-suggestion") {
      if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const id = String(body.id ?? "");
      const status = ["NEW", "REVIEWING", "ACCEPTED", "REJECTED"].includes(String(body.status)) ? String(body.status) : null;
      if (!id || !status) return apiErr(400, "شناسه و وضعیت لازم است.", "BAD_REQUEST");
      const updated = await db.suggestion.updateMany({
        where: { id, schoolId },
        data: { status, adminNote: (body.adminNote as string) ?? undefined },
      });
      await audit({ user: me, action: "بازبینی پیشنهاد", entityType: "Suggestion", entityId: id, schoolId, meta: { status } });
      return apiOk({ updated: updated.count });
    }

    if (action === "close-poll") {
      if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const id = String(body.id ?? "");
      const active = body.active === true; // پیش‌فرض: بستن نظرسنجی
      await db.poll.updateMany({ where: { id, schoolId }, data: { active } });
      await audit({ user: me, action: active ? "بازگشایی نظرسنجی" : "بستن نظرسنجی", entityType: "Poll", entityId: id, schoolId });
      return apiOk({ ok: true, active });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

const suggestBuckets = new Map<string, { n: number; reset: number }>();
function rateLimitSuggest(userId: string): boolean {
  const now = Date.now();
  const b = suggestBuckets.get(userId);
  if (!b || b.reset < now) {
    suggestBuckets.set(userId, { n: 1, reset: now + 60000 });
    return true;
  }
  b.n++;
  return b.n <= 3;
}
