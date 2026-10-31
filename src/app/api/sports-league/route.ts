import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/**
 * GET /api/sports-league — تیم‌ها، بازی‌ها و جدول رده‌بندی محاسبه‌شده از نتایج
 * POST { action: "team" | "match" | "result" }
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const teams = await db.leagueTeam.findMany({ where: { schoolId }, orderBy: { name: "asc" } });
    const matches = await db.leagueMatch.findMany({ where: { schoolId }, orderBy: { date: "desc" }, take: 100 });
    const table = new Map<string, { team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number }>();
    const row = (name: string) => {
      const cur = table.get(name) ?? { team: name, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      table.set(name, cur);
      return cur;
    };
    for (const tm of teams) row(tm.name);
    for (const m of matches) {
      if (m.homeScore === null || m.awayScore === null) continue;
      const h = row(m.homeTeam);
      const a = row(m.awayTeam);
      h.played += 1; a.played += 1;
      h.gf += m.homeScore; h.ga += m.awayScore;
      a.gf += m.awayScore; a.ga += m.homeScore;
      if (m.homeScore > m.awayScore) { h.won += 1; h.points += 3; a.lost += 1; }
      else if (m.homeScore < m.awayScore) { a.won += 1; a.points += 3; h.lost += 1; }
      else { h.drawn += 1; a.drawn += 1; h.points += 1; a.points += 1; }
    }
    const standings = [...table.values()].sort((x, y) => y.points - x.points || (y.gf - y.ga) - (x.gf - x.ga));
    return apiOk({ isStaff: (STAFF as readonly string[]).includes(me.role), teams, matches, standings });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ action?: string; name?: string; sport?: string; className?: string; matchId?: string; homeTeam?: string; awayTeam?: string; date?: string; homeScore?: number; awayScore?: number }>(req);
    const action = String(body.action ?? "");
    if (action === "team") {
      const name = String(body.name ?? "").trim();
      if (!name) return apiErr(400, "نام تیم لازم است.", "BAD_INPUT");
      const created = await db.leagueTeam.create({
        data: { schoolId, name, sport: body.sport ? String(body.sport).trim() : "فوتسال", className: body.className ? String(body.className).trim() : null },
      });
      return apiOk({ id: created.id });
    }
    if (action === "match") {
      const homeTeam = String(body.homeTeam ?? "").trim();
      const awayTeam = String(body.awayTeam ?? "").trim();
      const date = String(body.date ?? "").trim();
      if (!homeTeam || !awayTeam || homeTeam === awayTeam) return apiErr(400, "دو تیم متفاوت لازم است.", "BAD_INPUT");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiErr(400, "تاریخ بازی را مثل 1404-08-15 بنویسید.", "BAD_DATE");
      const created = await db.leagueMatch.create({ data: { schoolId, homeTeam, awayTeam, date } });
      return apiOk({ id: created.id });
    }
    if (action === "result") {
      const match = await db.leagueMatch.findFirst({ where: { id: String(body.matchId ?? ""), schoolId } });
      if (!match) return apiErr(404, "بازی یافت نشد.", "NOT_FOUND");
      await db.leagueMatch.update({
        where: { id: match.id },
        data: { homeScore: Math.max(0, Math.round(Number(body.homeScore ?? 0))), awayScore: Math.max(0, Math.round(Number(body.awayScore ?? 0))) },
      });
      return apiOk({ ok: true });
    }
    return apiErr(400, "عملیات نامعتبر است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
