import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";
import { GUIDANCE_AREAS, rankStreams, type GuidanceScores } from "@/lib/guidance";

/* ============================================================
   بهار | هدایت تحصیلی — مشاور نمرات هفت حوزه را ثبت می‌کند،
   موتور وزن‌دار رشته‌ها را رتبه‌بندی می‌کند و دانش‌آموز و
   ولی پیشنهاد و یادداشت مشاور را می‌بینند.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const studentIdParam = new URL(req.url).searchParams.get("studentId") ?? "";
    let studentId = studentIdParam;
    if (me.role === "STUDENT") {
      studentId = (await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id ?? "";
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentId = studentIdParam && links.some((l) => l.studentId === studentIdParam) ? studentIdParam : (links[0]?.studentId ?? "");
    } else {
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
      if (!studentId || !schoolId) return apiOk({ record: null, areas: GUIDANCE_AREAS });
      const ok = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
      if (!ok) return apiOk({ record: null, areas: GUIDANCE_AREAS });
    }
    if (!studentId) return apiOk({ record: null, areas: GUIDANCE_AREAS });
    const rec = await db.guidanceRecord.findUnique({ where: { studentId } });
    if (!rec) return apiOk({ record: null, areas: GUIDANCE_AREAS });
    const scores = JSON.parse(rec.scores || "{}") as GuidanceScores;
    return apiOk({
      record: { scores, recommended: rec.recommended, counselorNote: rec.counselorNote, updatedAt: rec.updatedAt },
      ranking: rankStreams(scores),
      areas: GUIDANCE_AREAS,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const body = await readJson<{ studentId?: string; scores?: GuidanceScores; counselorNote?: string }>(req);
    const studentId = String(body.studentId ?? "");
    const st = await db.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const scores: GuidanceScores = {};
    for (const a of GUIDANCE_AREAS) {
      const v = Number(body.scores?.[a.key] ?? 0);
      scores[a.key] = Math.min(20, Math.max(0, Number.isFinite(v) ? v : 0));
    }
    const ranking = rankStreams(scores);
    const rec = await db.guidanceRecord.upsert({
      where: { studentId },
      create: {
        schoolId: st.schoolId, studentId, scores: JSON.stringify(scores),
        recommended: ranking[0]?.key ?? null,
        counselorNote: body.counselorNote?.trim().slice(0, 1000) || null, updatedById: me.id,
      },
      update: {
        scores: JSON.stringify(scores), recommended: ranking[0]?.key ?? null,
        counselorNote: body.counselorNote?.trim().slice(0, 1000) || null, updatedById: me.id,
      },
    });
    return apiOk({ record: rec, ranking });
  } catch (e) {
    return handleApiError(e);
  }
}
