import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, rateLimit, ipOf } from "@/lib/api";
import { botPlatform, validateWebAppInitData } from "@/lib/bots";
import { ROLE_LABELS } from "@/lib/roles";
import { todayJalali } from "@/lib/persian";

/**
 * POST /api/bots/miniapp — احراز هویت مینی‌اپ (تلگرام/بله WebApp) + خلاصهٔ کاربر.
 * initData با توکن ربات همان اتصال اعتبارسنجی می‌شود؛ کاربر از روی پیوند چت
 * شناخته می‌شود. فقط خواندنی است و هیچ نشست وبی صادر نمی‌کند.
 */
export async function POST(req: NextRequest) {
  try {
    if (!rateLimit(`miniapp:${ipOf(req)}`, 30, 60_000)) return apiErr(429, "درخواست‌های زیاد — کمی صبر کنید.", "RATE_LIMITED");
    const body = await readJson<{ connectionId?: string; initData?: string }>(req);
    const conn = await db.botConnection.findUnique({ where: { id: String(body.connectionId ?? "") } });
    if (!conn || !conn.isActive) return apiErr(404, "اتصال یافت نشد.", "NOT_FOUND");
    if (!botPlatform(conn.platform).miniApp) return apiErr(400, "این پلتفرم مینی‌اپ ندارد.", "NO_MINIAPP");
    const v = validateWebAppInitData(String(body.initData ?? ""), conn.token);
    if (!v.ok) return apiErr(401, "امضای مینی‌اپ معتبر نیست.", "BAD_INITDATA");
    const link = await db.botLink.findFirst({
      where: { connectionId: conn.id, chatId: v.userId, userId: { not: null } },
      include: { user: { select: { id: true, firstName: true, lastName: true, role: true, schoolId: true, isActive: true } } },
    });
    if (!link?.user || !link.user.isActive) {
      return apiOk({ linked: false });
    }
    const user = link.user;
    const school = user.schoolId ? await db.school.findUnique({ where: { id: user.schoolId }, select: { name: true } }) : null;
    const today = todayJalali();
    const base = {
      linked: true as const,
      name: `${user.firstName} ${user.lastName}`,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] ?? user.role,
      schoolName: school?.name ?? null,
      today,
    };

    const studentSummary = async (studentId: string) => {
      const [att, fees, grades] = await Promise.all([
        db.attendance.findFirst({ where: { studentId, date: today, period: 0 }, select: { status: true, method: true } }),
        db.studentFee.count({ where: { studentId, status: { not: "PAID" } } }),
        db.gradeRecord.findMany({
          where: { studentId },
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { subject: { select: { name: true } } },
        }),
      ]);
      return {
        todayStatus: att?.status ?? null,
        todayMethod: att?.method ?? null,
        unpaidFees: fees,
        recentGrades: grades.map((g) => ({ subject: g.subject.name, score: g.score, maxScore: g.maxScore, kind: g.kind })),
      };
    };

    if (user.role === "PARENT" || user.role === "CUSTODIAN") {
      const links = await db.studentParent.findMany({
        where: { parentUserId: user.id },
        include: {
          student: {
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true } },
              class: { select: { name: true } },
            },
          },
        },
      });
      const children: Record<string, unknown>[] = [];
      for (const l of links) {
        children.push({
          id: l.student.id,
          name: `${l.student.user.firstName} ${l.student.user.lastName}`,
          className: l.student.class?.name ?? null,
          ...(await studentSummary(l.student.id)),
        });
      }
      return apiOk({ ...base, children });
    }
    if (user.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: user.id }, select: { id: true, class: { select: { name: true } } } });
      if (!profile) return apiOk({ ...base, children: [] });
      return apiOk({ ...base, className: profile.class?.name ?? null, ...(await studentSummary(profile.id)) });
    }
    // کارکنان: نبض امروز مدرسه
    if (user.schoolId) {
      const [present, absent, late] = await Promise.all([
        db.attendance.count({ where: { date: today, period: 0, status: "PRESENT", student: { schoolId: user.schoolId } } }),
        db.attendance.count({ where: { date: today, period: 0, status: "ABSENT", student: { schoolId: user.schoolId } } }),
        db.attendance.count({ where: { date: today, period: 0, status: "LATE", student: { schoolId: user.schoolId } } }),
      ]);
      return apiOk({ ...base, schoolToday: { present, absent, late } });
    }
    return apiOk(base);
  } catch (e) {
    return handleApiError(e);
  }
}
