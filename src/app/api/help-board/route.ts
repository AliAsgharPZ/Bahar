import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

/**
 * GET /api/help-board — پرسش‌های درسی مدرسه + پاسخ‌ها
 * POST /api/help-board { action: "ask" | "answer" | "solve" | "best" }
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const rows = await db.helpPost.findMany({
      where: { schoolId },
      orderBy: [{ solved: "asc" }, { createdAt: "desc" }],
      take: 50,
      include: { answers: { orderBy: [{ isBest: "desc" }, { createdAt: "asc" }] } },
    });
    return apiOk({
      items: rows.map((p) => ({
        id: p.id, authorName: p.authorName, authorUserId: p.authorUserId, subject: p.subject,
        title: p.title, text: p.text, solved: p.solved, createdAt: p.createdAt,
        mine: p.authorUserId === me.id,
        answers: p.answers.map((a) => ({ id: a.id, authorName: a.authorName, text: a.text, isBest: a.isBest, mine: a.authorUserId === me.id })),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ action?: string; postId?: string; answerId?: string; subject?: string; title?: string; text?: string }>(req);
    const action = String(body.action ?? "ask");
    const myName = `${me.firstName} ${me.lastName}`;

    if (action === "ask") {
      const title = String(body.title ?? "").trim();
      const text = String(body.text ?? "").trim();
      if (!title || text.length < 5) return apiErr(400, "عنوان و شرح پرسش لازم است.", "BAD_INPUT");
      const created = await db.helpPost.create({
        data: { schoolId, authorUserId: me.id, authorName: myName, subject: body.subject ? String(body.subject).trim() : null, title, text: text.slice(0, 3000) },
      });
      return apiOk({ id: created.id });
    }

    const post = await db.helpPost.findFirst({ where: { id: String(body.postId ?? ""), schoolId } });
    if (!post) return apiErr(404, "پرسش یافت نشد.", "NOT_FOUND");

    if (action === "answer") {
      const text = String(body.text ?? "").trim();
      if (text.length < 2) return apiErr(400, "متن پاسخ لازم است.", "BAD_INPUT");
      const created = await db.helpAnswer.create({
        data: { postId: post.id, authorUserId: me.id, authorName: myName, text: text.slice(0, 3000) },
      });
      if (post.authorUserId !== me.id) {
        await notifyUser(post.authorUserId, "INFO", "پرسش‌تان پاسخ گرفت", `«${post.title}» — ${myName} پاسخ داد.`, "/app/help-board", "HELP");
      }
      return apiOk({ id: created.id });
    }

    if (action === "solve") {
      if (post.authorUserId !== me.id && !["MANAGER", "TEACHER", "SUPER_ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      await db.helpPost.update({ where: { id: post.id }, data: { solved: true } });
      return apiOk({ ok: true });
    }

    if (action === "best") {
      if (post.authorUserId !== me.id) return apiErr(403, "فقط پرسش‌کننده بهترین پاسخ را انتخاب می‌کند.", "FORBIDDEN");
      const answer = await db.helpAnswer.findFirst({ where: { id: String(body.answerId ?? ""), postId: post.id } });
      if (!answer) return apiErr(404, "پاسخ یافت نشد.", "NOT_FOUND");
      await db.helpAnswer.updateMany({ where: { postId: post.id }, data: { isBest: false } });
      await db.helpAnswer.update({ where: { id: answer.id }, data: { isBest: true } });
      await db.helpPost.update({ where: { id: post.id }, data: { solved: true } });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
