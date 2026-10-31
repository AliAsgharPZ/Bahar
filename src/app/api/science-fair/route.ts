import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/science-fair — پروژه‌های جشنوارهٔ علمی؛ POST: ثبت پروژه؛ PATCH: امتیاز و جایزه از داوران */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const items = await db.scienceProject.findMany({ where: { schoolId }, orderBy: [{ score: "desc" }, { createdAt: "desc" }], take: 200 });
    return apiOk({ isStaff: (STAFF as readonly string[]).includes(me.role), items });
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
    const body = await readJson<{ title?: string; team?: string; category?: string; description?: string }>(req);
    const title = String(body.title ?? "").trim();
    const team = String(body.team ?? "").trim();
    if (!title || !team) return apiErr(400, "عنوان پروژه و نام تیم/اجرا لازم است.", "BAD_INPUT");
    const created = await db.scienceProject.create({
      data: {
        schoolId, title, team,
        category: body.category ? String(body.category).trim() : null,
        description: body.description ? String(body.description).trim().slice(0, 2000) : null,
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...STAFF]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; score?: number; award?: string }>(req);
    const found = await db.scienceProject.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "پروژه یافت نشد.", "NOT_FOUND");
    const updated = await db.scienceProject.update({
      where: { id: found.id },
      data: {
        score: body.score !== undefined ? Math.min(100, Math.max(0, Math.round(Number(body.score)))) : found.score,
        award: body.award !== undefined ? String(body.award).trim() || null : found.award,
      },
    });
    return apiOk({ id: updated.id });
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
    const found = await db.scienceProject.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    await db.scienceProject.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
