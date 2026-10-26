import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { todayKey } from "@/lib/persian";

/* ============================================================
   بهار | حضور و غیاب کارکنان — ثبت روزانه توسط مدیریت،
   مشاهدهٔ سابقه برای خود کارمند
   ============================================================ */

const STATUSES = ["PRESENT", "ABSENT", "LATE", "LEAVE", "MISSION"] as const;
const STAFF_ROLES = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayKey();
    const isManager = me.role === "MANAGER" || me.role === "DEPUTY" || me.role === "SUPER_ADMIN" || me.role === "ADMIN";

    if (isManager) {
      const [staff, records] = await Promise.all([
        db.user.findMany({
          where: { schoolId, role: { in: STAFF_ROLES }, isActive: true },
          select: { id: true, firstName: true, lastName: true, role: true },
          orderBy: [{ role: "asc" }, { lastName: "asc" }],
        }),
        db.staffAttendance.findMany({ where: { schoolId, date } }),
      ]);
      const byUser = new Map(records.map((r) => [r.userId, r]));
      return apiOk({
        manager: true,
        date,
        staff: staff.map((u) => ({ user: u, record: byUser.get(u.id) ?? null })),
      });
    }

    const mine = await db.staffAttendance.findMany({
      where: { schoolId, userId: me.id },
      orderBy: { date: "desc" },
      take: 60,
    });
    return apiOk({ manager: false, date, mine });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      date?: string;
      records?: Array<{ userId?: string; status?: string; checkIn?: string; checkOut?: string; note?: string }>;
    }>(req);
    const date = (body.date ?? todayKey()).slice(0, 10);
    const records = (body.records ?? []).slice(0, 500);
    if (!records.length) return apiErr(400, "رکوردی ارسال نشده است.", "EMPTY");

    const staffIds = new Set(
      (await db.user.findMany({ where: { schoolId, role: { in: STAFF_ROLES }, isActive: true }, select: { id: true } })).map((u) => u.id),
    );
    let saved = 0;
    for (const r of records) {
      const userId = String(r.userId ?? "");
      const status = String(r.status ?? "");
      if (!staffIds.has(userId) || !STATUSES.includes(status as (typeof STATUSES)[number])) continue;
      await db.staffAttendance.upsert({
        where: { userId_date: { userId, date } },
        create: {
          schoolId, userId, date, status,
          checkIn: r.checkIn?.slice(0, 5) || null,
          checkOut: r.checkOut?.slice(0, 5) || null,
          note: r.note?.trim().slice(0, 200) || null,
        },
        update: {
          status,
          checkIn: r.checkIn?.slice(0, 5) || null,
          checkOut: r.checkOut?.slice(0, 5) || null,
          note: r.note?.trim().slice(0, 200) || null,
        },
      });
      saved++;
    }
    await audit({ user: me, action: "ثبت حضور و غیاب کارکنان", entityType: "StaffAttendance", schoolId, meta: { date, saved } });
    return apiOk({ saved });
  } catch (e) {
    return handleApiError(e);
  }
}
