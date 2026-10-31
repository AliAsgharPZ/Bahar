import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId } from "@/lib/api";
import { notifyUser } from "@/lib/notify";
import { jalaliParts } from "@/lib/persian";

/** GET /api/birthdays — تولدهای امروز و ۳۰ روز آیندهٔ مدرسه (بر اساس تاریخ تولد ثبت‌شده) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const users = await db.user.findMany({
      where: { schoolId, isActive: true, birthDate: { not: null } },
      select: { id: true, firstName: true, lastName: true, role: true, birthDate: true },
    });
    const now = jalaliParts(new Date());
    const todayKey = now.m * 100 + now.d;
    const items = users.map((u) => {
      const p = jalaliParts(u.birthDate as Date);
      const key = p.m * 100 + p.d;
      let inDays = key - todayKey;
      if (inDays < 0) inDays += 10000; // سال بعد (تقریبی در مرز ماه‌ها، فقط برای مرتب‌سازی و نمایش «پیش‌رو»)
      return { userId: u.id, name: `${u.firstName} ${u.lastName}`, role: u.role, month: p.m, day: p.d, inDays, isToday: key === todayKey };
    }).filter((x) => x.inDays <= 100).sort((a, b) => a.inDays - b.inDays).slice(0, 60);
    return apiOk({ items, todayCount: items.filter((i) => i.isToday).length });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/birthdays { userId } — فرستادن تبریک تولد */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ userId?: string }>(req);
    const target = await db.user.findFirst({ where: { id: String(body.userId ?? ""), schoolId }, select: { id: true, firstName: true } });
    if (!target) return apiErr(404, "کاربر یافت نشد.", "NOT_FOUND");
    if (target.id === me.id) return apiErr(400, "به خودتان تبریک نگویید!", "SELF");
    await notifyUser(target.id, "INFO", "تولدتان مبارک!", `${me.firstName} ${me.lastName} تولدتان را تبریک گفت.`, "/app/birthdays", "BIRTHDAY");
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
