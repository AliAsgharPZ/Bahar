import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const OFFICE = ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"] as const;
const STATUSES = ["NOMINATION", "VOTING", "CLOSED"] as const;

/**
 * GET /api/elections — انتخابات‌ها + نامزدها + رأی من؛ نتایج وقتی بسته شد (یا برای دفتر همیشه)
 * POST /api/elections — action: create | nominate | approve | status | vote
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isOffice = (OFFICE as readonly string[]).includes(me.role);
    const elections = await db.election.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { candidates: true, votes: true },
    });
    return apiOk({
      isOffice,
      elections: elections.map((e) => {
        const myVote = e.votes.find((v) => v.voterUserId === me.id);
        const showResults = e.status === "CLOSED" || isOffice;
        return {
          id: e.id, title: e.title, status: e.status, startsAt: e.startsAt, endsAt: e.endsAt,
          myCandidateId: myVote?.candidateId ?? null,
          candidates: e.candidates
            .filter((c) => c.approved || isOffice)
            .map((c) => ({
              id: c.id, name: c.name, className: c.className, manifesto: c.manifesto, approved: c.approved,
              votes: showResults ? e.votes.filter((v) => v.candidateId === c.id).length : null,
            })),
          totalVotes: showResults ? e.votes.length : null,
        };
      }),
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
    const body = await readJson<{ action?: string; title?: string; electionId?: string; candidateId?: string; studentId?: string; name?: string; className?: string; manifesto?: string; status?: string }>(req);
    const action = String(body.action ?? "");
    const isOffice = (OFFICE as readonly string[]).includes(me.role);

    if (action === "create") {
      if (!isOffice) return apiErr(403, "فقط دفتر مدرسه انتخابات می‌سازد.", "FORBIDDEN");
      const title = String(body.title ?? "").trim();
      if (!title) return apiErr(400, "عنوان انتخابات لازم است.", "BAD_INPUT");
      const created = await db.election.create({ data: { schoolId, title, createdById: me.id } });
      return apiOk({ id: created.id });
    }

    const election = await db.election.findFirst({ where: { id: String(body.electionId ?? ""), schoolId } });
    if (!election) return apiErr(404, "انتخابات یافت نشد.", "NOT_FOUND");

    if (action === "nominate") {
      if (election.status !== "NOMINATION") return apiErr(409, "مهلت نامزدی تمام شده است.", "NOT_NOMINATION");
      const name = String(body.name ?? "").trim();
      if (!name) return apiErr(400, "نام نامزد لازم است.", "BAD_INPUT");
      const created = await db.electionCandidate.create({
        data: {
          electionId: election.id,
          studentId: String(body.studentId ?? me.id),
          name,
          className: body.className ? String(body.className).trim() : null,
          manifesto: body.manifesto ? String(body.manifesto).trim().slice(0, 1000) : null,
        },
      });
      return apiOk({ id: created.id });
    }

    if (action === "approve") {
      if (!isOffice) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const cand = await db.electionCandidate.findFirst({ where: { id: String(body.candidateId ?? ""), electionId: election.id } });
      if (!cand) return apiErr(404, "نامزد یافت نشد.", "NOT_FOUND");
      await db.electionCandidate.update({ where: { id: cand.id }, data: { approved: true } });
      return apiOk({ ok: true });
    }

    if (action === "status") {
      if (!isOffice) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      const status = String(body.status ?? "");
      if (!(STATUSES as readonly string[]).includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
      await db.election.update({ where: { id: election.id }, data: { status } });
      return apiOk({ ok: true });
    }

    if (action === "vote") {
      if (election.status !== "VOTING") return apiErr(409, "رأی‌گیری باز نیست.", "NOT_VOTING");
      const cand = await db.electionCandidate.findFirst({ where: { id: String(body.candidateId ?? ""), electionId: election.id, approved: true } });
      if (!cand) return apiErr(404, "نامزد یافت نشد.", "NOT_FOUND");
      const existing = await db.electionVote.findFirst({ where: { electionId: election.id, voterUserId: me.id } });
      if (existing) return apiErr(409, "قبلاً رأی داده‌اید.", "ALREADY_VOTED");
      await db.electionVote.create({ data: { electionId: election.id, candidateId: cand.id, voterUserId: me.id } });
      return apiOk({ ok: true });
    }

    return apiErr(400, "عملیات نامعتبر است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
