import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const MOD = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;

/** GET /api/kindness-wall — کارت‌های تأییدشده روی دیوار + صف تأیید برای همکاران */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const canMod = (MOD as readonly string[]).includes(me.role);
    const approved = await db.kindnessNote.findMany({ where: { schoolId, approved: true }, orderBy: { createdAt: "desc" }, take: 60 });
    const pending = canMod
      ? await db.kindnessNote.findMany({ where: { schoolId, approved: false }, orderBy: { createdAt: "asc" }, take: 60 })
      : [];
    return apiOk({ canMod, approved, pending });
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
    const body = await readJson<{ toName?: string; text?: string; anonymous?: boolean }>(req);
    const toName = String(body.toName ?? "").trim();
    const text = String(body.text ?? "").trim();
    if (!toName || text.length < 5) return apiErr(400, "نام کسی که می‌خواهید از او تشکر کنید و متن کارت لازم است.", "BAD_INPUT");
    const created = await db.kindnessNote.create({
      data: {
        schoolId,
        authorUserId: body.anonymous === true ? null : me.id,
        fromName: body.anonymous === true ? null : `${me.firstName} ${me.lastName}`,
        toName, text: text.slice(0, 500),
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, [...MOD]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ id?: string; approve?: boolean }>(req);
    const found = await db.kindnessNote.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "کارت یافت نشد.", "NOT_FOUND");
    if (body.approve === true) {
      await db.kindnessNote.update({ where: { id: found.id }, data: { approved: true } });
    } else {
      await db.kindnessNote.delete({ where: { id: found.id } });
    }
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
