import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor, isDemoUser } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

// ============================================================
// بهار | خونه‌ها (House System) — فهرست، جدول امتیاز، تعریف/حذف
// امتیاز خونه = مجموع امتیاز رفتاری + امتیاز نشان‌های اعضا
// ============================================================

/** GET /api/houses — خونه‌های مدرسه + جدول امتیاز */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    // FIX (راند ۱۸): acting-school — سوپرادمین/ادمین داخل پنل مدرسه
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiOk({ houses: [], noSchool: true });

    const houses = await db.house.findMany({
      where: { schoolId },
      orderBy: { name: "asc" },
      include: {
        students: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true } },
            behaviorRecords: { select: { points: true } },
            badges: { select: { badge: { select: { points: true } } } },
          },
        },
      },
    });

    const leaderboard = houses.map((h) => {
      let behavior = 0, badgePts = 0;
      const members = h.students.map((s) => {
        const sBehavior = s.behaviorRecords.reduce((a, r) => a + r.points, 0);
        const sBadge = s.badges.reduce((a, b) => a + (b.badge.points ?? 0), 0);
        behavior += sBehavior;
        badgePts += sBadge;
        return {
          id: s.id,
          name: `${s.user.firstName} ${s.user.lastName}`,
          points: sBehavior + sBadge,
        };
      });
      members.sort((a, b) => b.points - a.points);
      return {
        id: h.id,
        name: h.name,
        color: h.color,
        motto: h.motto,
        members: h.students.length,
        behaviorPoints: behavior,
        badgePoints: badgePts,
        total: behavior + badgePts,
        topMembers: members.slice(0, 5),
      };
    });
    leaderboard.sort((a, b) => b.total - a.total);

    return apiOk({ houses: leaderboard });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/houses — تعریف خونه جدید { name, color?, motto? } */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN", "DEPUTY"]);
    if (me.role === "DEPUTY" && !hasPermission(me, "manage_classes")) {
      return apiErr(403, "دسترسی مدیریت کلاس‌ها برای شما فعال نیست.", "FORBIDDEN");
    }
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست؛ سوپرادمین باید وارد پنل یک مدرسه شود.", "NO_SCHOOL");
    const body = await readJson<{ name?: string; color?: string; motto?: string }>(req);
    const name = String(body.name ?? "").trim();
    if (name.length < 2 || name.length > 30) return apiErr(400, "نام خونه باید ۲ تا ۳۰ نویسه باشد.", "BAD_NAME");
    const color = /^#[0-9a-fA-F]{6}$/.test(String(body.color ?? "")) ? String(body.color) : "#00825e";
    const motto = body.motto ? String(body.motto).slice(0, 80) : null;

    const exists = await db.house.findUnique({ where: { schoolId_name: { schoolId, name } } });
    if (exists) return apiErr(409, "خونه‌ای با این نام قبلاً تعریف شده است.", "DUPLICATE");

    const house = await db.house.create({ data: { schoolId, name, color, motto } });
    await audit({ user: me, action: "تعریف خونه", entityType: "House", entityId: house.id, meta: { name } });
    return apiOk({ house });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/houses?id= — حذف خونه (دانش‌آموزان بدون خونه می‌شوند) */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "ADMIN", "DEPUTY"]);
    if (me.role === "DEPUTY" && !hasPermission(me, "manage_classes")) {
      return apiErr(403, "دسترسی مدیریت کلاس‌ها برای شما فعال نیست.", "FORBIDDEN");
    }
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست؛ سوپرادمین باید وارد پنل یک مدرسه شود.", "NO_SCHOOL");
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return apiErr(400, "شناسه خونه الزامی است.", "BAD_INPUT");
    const house = await db.house.findFirst({ where: { id, schoolId } });
    if (!house) return apiErr(404, "خونه یافت نشد.", "NOT_FOUND");
    await db.house.delete({ where: { id } }); // SetNull روی دانش‌آموزان
    await audit({ user: me, action: "حذف خونه", entityType: "House", entityId: id, meta: { name: house.name } });
    return apiOk({ deleted: id });
  } catch (e) {
    return handleApiError(e);
  }
}
