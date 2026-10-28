import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, ApiError, isDemoUser , actingSchoolIdFor } from "@/lib/api";
import { getCountrySync } from "@/lib/country/cache";
import { hasPermission, parsePermissions } from "@/lib/roles";

// ============================================================
// اطلاعیه‌ها — هدف‌گیری بر اساس چند نوع کاربر + نقشه ایران
// (استان/شهرستان) — دو فیلتر اختیاری و قابل ترکیب (AND)
// scope=SCHOOL برای مدرسه؛ scope=PLATFORM برای ادمین سرویس
// ============================================================

const ROLE_TO_TARGET: Record<string, string> = {
  MANAGER: "MANAGERS",
  DEPUTY: "TEACHERS",
  TEACHER: "TEACHERS",
  STUDENT: "STUDENTS",
  PARENT: "PARENTS",
};

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** آیا این اطلاعیه برای این کاربر هدف‌گذاری شده است؟ */
function targetsUser(
  a: { audienceRoles: string[]; targetProvinces: string[]; targetCounties: string[]; scope: string; schoolId: string | null; classId: string | null },
  user: { role: string; schoolId: string | null; province: string | null; county: string | null },
  userClassIds: string[],
): boolean {
  // ۱) نوع کاربر — خالی یعنی همه
  if (a.audienceRoles.length > 0) {
    const target = ROLE_TO_TARGET[user.role] ?? (user.role === "SUPER_ADMIN" || user.role === "ADMIN" ? "MANAGERS" : null);
    if (!target || !a.audienceRoles.includes(target)) return false;
  }
  // ۲) کلاس خاص
  if (a.classId && !userClassIds.includes(a.classId)) return false;
  // ۳) نقشه — استان/شهرستان مدرسه کاربر
  if (a.targetProvinces.length > 0 || a.targetCounties.length > 0) {
    if (!user.schoolId) {
      // کاربر بدون مدرسه فقط اگر سوپرادمین/ادمین باشد و هدف MANAGERS انتخاب شده
      return user.role === "SUPER_ADMIN" || user.role === "ADMIN";
    }
    if (a.targetCounties.length > 0) {
      const key = `${user.province ?? ""}|${user.county ?? ""}`;
      if (!a.targetCounties.includes(key)) return false;
    } else if (a.targetProvinces.length > 0) {
      if (!user.province || !a.targetProvinces.includes(user.province)) return false;
    }
  }
  return true;
}

/** GET /api/announcements — اطلاعیه‌های دیده‌شده توسط من (مدرسه + سراسری) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? undefined;

    // مشخصات جغرافیایی مدرسه من
    let province: string | null = null;
    let county: string | null = null;
    if (schoolId) {
      const s = await db.school.findUnique({ where: { id: schoolId }, select: { province: true, county: true, city: true } });
      province = s?.province ?? null;
      county = s?.county ?? s?.city ?? null;
    }

    // کلاس‌های من (دانش‌آموز/ولی)
    const userClassIds: string[] = [];
    if (me.role === "STUDENT") {
      const p = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
      if (p?.classId) userClassIds.push(p.classId);
    } else if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: { student: { select: { classId: true } } },
      });
      userClassIds.push(...(kids.map((k) => k.student.classId).filter(Boolean) as string[]));
    }

    const rows = await db.announcement.findMany({
      where: {
        OR: [
          { scope: "PLATFORM" },
          ...(schoolId ? [{ scope: "SCHOOL", schoolId }] : []),
        ],
      },
      include: {
        class: { select: { id: true, name: true } },
        school: { select: { id: true, name: true } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: 120,
    });

    const visible = rows
      .map((a) => ({
        ...a,
        audienceRoles: parseJsonArray(a.audienceRoles),
        targetProvinces: parseJsonArray(a.targetProvinces),
        targetCounties: parseJsonArray(a.targetCounties),
      }))
      .filter((a) => targetsUser(a, { role: me.role, schoolId: me.schoolId, province, county }, userClassIds));

    return apiOk({ announcements: visible });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/announcements — ارسال اطلاعیه (مدرسه یا سراسری برای ادمین) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<Record<string, unknown>>(req);
    const scope = body.scope === "PLATFORM" ? "PLATFORM" : "SCHOOL";

    // ادمین سرویس با دسترسی سراسری → PLATFORM مجاز
    const canPlatform = me.role === "SUPER_ADMIN" || (me.role === "ADMIN" && hasPermission(me, "platform_announcements"));
    if (scope === "PLATFORM") {
      if (!canPlatform) {
        throw new ApiError(403, "FORBIDDEN", "ارسال اطلاعیه سراسری برای شما فعال نیست.");
      }
    } else {
      // اطلاعیه مدرسه‌ای — مدیریت دسترسی مدرسه
      if (!["MANAGER", "SUPER_ADMIN"].includes(me.role)) {
        if (me.role === "ADMIN") {
          const acting = actingSchoolIdFor(req, me) ?? undefined;
          if (!acting) throw new ApiError(403, "FORBIDDEN", "برای اطلاعیه مدرسه‌ای وارد پنل مدرسه شوید.");
        } else if (!hasPermission(me, "manage_announcements")) {
          throw new ApiError(403, "FORBIDDEN", "دسترسی ارسال اطلاعیه ندارید.");
        }
      }
    }

    const title = String(body.title ?? "").trim();
    const text = String(body.body ?? "").trim();
    if (title.length < 2 || text.length < 2) {
      return apiErr(400, "عنوان و متن اطلاعیه الزامی است.", "BAD_INPUT");
    }
    if (text.length > 600) {
      return apiErr(400, "متن اطلاعیه بیش از حد بلند است؛ برای محتوای بلند از شاد استفاده کنید.", "TOO_LONG");
    }

    // ── هدف‌گیری نوع کاربر (چندتایی) ──
    const validRoles = ["MANAGERS", "TEACHERS", "STUDENTS", "PARENTS"];
    const audienceRoles = Array.isArray(body.audienceRoles)
      ? (body.audienceRoles as string[]).filter((r) => validRoles.includes(r))
      : [];

    // ── هدف‌گیری نقشه (حدود از پروفایل کشور فعال — ایران: ۳۱/۴۲۹) ──
    const country = getCountrySync();
    const maxProvinces = Math.max(1, country.regions.length);
    const maxCounties = Math.max(1, country.regions.reduce((s, r) => s + r.counties.length, 0));
    const targetProvinces = Array.isArray(body.targetProvinces)
      ? (body.targetProvinces as string[]).filter((p) => typeof p === "string" && country.regions.some((r) => r.name === p)).slice(0, maxProvinces)
      : [];
    const targetCounties = Array.isArray(body.targetCounties)
      ? (body.targetCounties as string[]).filter((c) => typeof c === "string" && c.includes("|")).slice(0, maxCounties)
      : [];

    let classId: string | null = null;
    let schoolId: string | null = null;
    if (scope === "SCHOOL") {
      schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
      if (!schoolId) return apiErr(400, "مدرسه‌ای برای ارسال مشخص نیست.", "NO_SCHOOL");
            if (body.classId) {
        classId = String(body.classId);
        const cls = await db.class.findUnique({ where: { id: classId } });
        if (!cls || cls.schoolId !== schoolId) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
      }
    }

    const announcement = await db.announcement.create({
      data: {
        scope,
        schoolId,
        title,
        body: text,
        audienceRoles: JSON.stringify(audienceRoles),
        targetProvinces: JSON.stringify(targetProvinces),
        targetCounties: JSON.stringify(targetCounties),
        classId,
        pinned: body.pinned === true,
        createdById: me.id,
      },
    });
    await audit({
      user: me, action: "CREATE_ANNOUNCEMENT", entityType: "ANNOUNCEMENT",
      entityId: announcement.id, schoolId,
      meta: { scope, audienceRoles, provinces: targetProvinces.length, counties: targetCounties.length },
    });
    return apiOk({ announcement });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.announcement.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (row.schoolId === null && !["SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "اطلاعیهٔ سراسری فقط توسط مدیر پلتفرم حذف می‌شود.", "FORBIDDEN");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.announcement.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
