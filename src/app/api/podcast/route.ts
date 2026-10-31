import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { todayJalali } from "@/lib/persian";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/podcast — قسمت‌های رادیو/پادکست مدرسه؛ POST/DELETE: همکاران */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const items = await db.podcastEpisode.findMany({ where: { schoolId }, orderBy: { date: "desc" }, take: 100 });
    return apiOk({ isStaff: (STAFF as readonly string[]).includes(me.role), items });
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
    const body = await readJson<{ title?: string; description?: string; url?: string; hostName?: string; date?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "عنوان قسمت لازم است.", "BAD_INPUT");
    const url = body.url ? String(body.url).trim() : null;
    if (url && !/^https?:\/\//i.test(url)) return apiErr(400, "نشانی فایل صوتی باید با http شروع شود.", "BAD_URL");
    const created = await db.podcastEpisode.create({
      data: {
        schoolId, title,
        description: body.description ? String(body.description).trim() : null,
        url, hostName: body.hostName ? String(body.hostName).trim() : null,
        date: body.date && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : todayJalali(),
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const found = await db.podcastEpisode.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.podcastEpisode.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
