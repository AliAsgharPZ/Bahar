import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, demoWriteBlock } from "@/lib/api";
import { notifyUser } from "@/lib/notify";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"] as const;

function norm(s: string) {
  return s.replace(/[\s‌]+/g, " ").trim().toLowerCase();
}

/** آیا عنوان یک پیداشده می‌تواند جواب یک گزارش گمشده باشد؟ (تطابق سادهٔ عنوان) */
function titleMatch(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

/**
 * GET /api/lost-found — تابلوی مدرسه: پیداشده‌های نزد مدرسه + گمشده‌های در جستجو
 * POST /api/lost-found — { mode: "lost" } گزارش گم‌شدن (همه) | { mode: "found" } ثبت پیداشده (کارکنان)
 * PATCH /api/lost-found — کارکنان: تحویل پیداشده / پیداشدن گمشده (+ اعلان به گزارش‌دهنده) / بستن
 * DELETE /api/lost-found?id= — کارکنان
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const isStaff = (STAFF as readonly string[]).includes(me.role);
    const rows = await db.lostFoundItem.findMany({ where: { schoolId }, orderBy: { foundAt: "desc" }, take: 300 });
    const shape = (r: (typeof rows)[number]) => ({
      id: r.id, kind: r.kind, title: r.title, description: r.description, location: r.location,
      foundAt: r.foundAt, status: r.status, claimedByName: r.claimedByName, claimedAt: r.claimedAt,
      reporterName: r.reporterName,
      contact: isStaff ? r.contact : null,
      mine: r.reporterUserId === me.id,
      note: isStaff ? r.note : null,
    });
    return apiOk({
      isStaff,
      found: rows.filter((r) => r.kind === "FOUND").map(shape),
      lost: rows.filter((r) => r.kind === "LOST").map(shape),
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
    const body = await readJson<{ mode?: string; title?: string; description?: string; location?: string; contact?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (title.length < 2) return apiErr(400, "نام وسیله لازم است.", "BAD_INPUT");
    const mode = body.mode === "found" ? "found" : "lost";

    if (mode === "found") {
      if (!(STAFF as readonly string[]).includes(me.role)) return apiErr(403, "ثبت پیداشده با دفتر/نگهبانی است.", "FORBIDDEN");
      const created = await db.lostFoundItem.create({
        data: {
          schoolId, kind: "FOUND", title,
          description: body.description ? String(body.description).trim() : null,
          location: body.location ? String(body.location).trim() : null,
          foundAt: new Date(), status: "FOUND",
        },
      });
      // تطابق احتمالی با گزارش‌های گمشدهٔ باز: به گزارش‌دهنده‌ها خبر بده
      const openLost = await db.lostFoundItem.findMany({ where: { schoolId, kind: "LOST", status: "SEARCHING" } });
      const matches = openLost.filter((l) => titleMatch(l.title, title));
      for (const m of matches) {
        if (m.reporterUserId) {
          await notifyUser(m.reporterUserId, "IMPORTANT", "شاید گمشده‌تان پیدا شده باشد", `یک «${title}» پیدا و در دفتر امانات ثبت شد؛ برای بررسی به بخش گمشده و پیداشده بیایید.`, "/app/lost-found", "LOST_FOUND");
        }
      }
      await audit({ user: me, action: "LOSTFOUND_REGISTER_FOUND", entityType: "LOST_FOUND", entityId: created.id, schoolId });
      return apiOk({ id: created.id, possibleMatches: matches.length });
    }

    const created = await db.lostFoundItem.create({
      data: {
        schoolId, kind: "LOST", title,
        description: body.description ? String(body.description).trim() : null,
        location: body.location ? String(body.location).trim() : null,
        contact: body.contact ? String(body.contact).trim() : null,
        foundAt: new Date(), status: "SEARCHING",
        reporterUserId: me.id,
        reporterName: `${me.firstName} ${me.lastName}`,
      },
    });
    // اگر عین همین وسیله همین حالا نزد مدرسه است، همان لحظه به گزارش‌دهنده بگو
    const held = await db.lostFoundItem.findMany({ where: { schoolId, kind: "FOUND", status: "FOUND" } });
    const possible = held.filter((f) => titleMatch(f.title, title)).length;
    await audit({ user: me, action: "LOSTFOUND_REPORT_LOST", entityType: "LOST_FOUND", entityId: created.id, schoolId });
    return apiOk({ id: created.id, possibleMatches: possible });
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
    const body = await readJson<{ id?: string; action?: string; claimedByName?: string; note?: string }>(req);
    const found = await db.lostFoundItem.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!found) return apiErr(404, "رکورد یافت نشد.", "NOT_FOUND");
    const action = String(body.action ?? "");
    if (action === "claim") {
      if (found.status === "CLAIMED") return apiErr(409, "قبلاً بسته/تحویل شده است.", "ALREADY_DONE");
      const name = String(body.claimedByName ?? "").trim();
      if (!name) return apiErr(400, "نام تحویل‌گیرنده/یابنده لازم است.", "BAD_INPUT");
      const updated = await db.lostFoundItem.update({
        where: { id: found.id },
        data: { status: "CLAIMED", claimedByName: name, claimedAt: new Date(), note: body.note ? String(body.note).trim() : found.note },
      });
      if (found.kind === "LOST" && found.reporterUserId) {
        await notifyUser(found.reporterUserId, "IMPORTANT", "گمشده‌تان پیدا شد", `«${found.title}» پیدا و تحویل شد (${name}).`, "/app/lost-found", "LOST_FOUND");
      }
      await audit({ user: me, action: "LOSTFOUND_CLAIM", entityType: "LOST_FOUND", entityId: found.id, schoolId });
      return apiOk({ id: updated.id, status: updated.status });
    }
    if (action === "dispose") {
      const updated = await db.lostFoundItem.update({
        where: { id: found.id },
        data: { status: "DISPOSED", note: body.note ? String(body.note).trim() : found.note },
      });
      await audit({ user: me, action: "LOSTFOUND_DISPOSE", entityType: "LOST_FOUND", entityId: found.id, schoolId });
      return apiOk({ id: updated.id, status: updated.status });
    }
    return apiErr(400, "عملیات نامعتبر است.", "BAD_ACTION");
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
    const found = await db.lostFoundItem.findFirst({ where: { id, schoolId } });
    if (!found) return apiErr(404, "رکورد یافت نشد.", "NOT_FOUND");
    await db.lostFoundItem.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
