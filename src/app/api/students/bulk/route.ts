import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser } from "@/lib/api";

// ============================================================
// بهار | عملیات گروهی دانش‌آموزان — انتقال کلاس / تغییر وضعیت / تگ / خونه
// همه عملیات‌ها پرمیژن‌دار، ممیزی‌شده و در دمو بلاک می‌شوند.
// ============================================================

const STUDENT_STATUSES = ["ACTIVE", "GRADUATED", "TRANSFERRED", "SUSPENDED"];

type BulkBody = {
  action?: string;
  ids?: string[];
  classId?: string | null;
  status?: string;
  tagKey?: string;
  tagMode?: "add" | "remove";
  houseId?: string | null;
};

/**
 * POST /api/students/bulk
 * body: { action: "moveClass" | "setStatus" | "tag" | "house", ids, ... }
 */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_students");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);

    const body = await readJson<BulkBody>(req);
    const ids = (body.ids ?? []).map(String).filter(Boolean);
    if (!Array.isArray(ids) || ids.length === 0) return apiErr(400, "هیچ دانش‌آموزی انتخاب نشده است.", "NO_IDS");
    if (ids.length > 500) return apiErr(400, "حداکثر ۵۰۰ دانش‌آموز در هر عملیات گروهی.", "TOO_MANY");

    // فقط دانش‌آموزان همان مدرسه
    const students = await db.student.findMany({
      where: { id: { in: ids }, schoolId },
      select: { id: true, tags: true, classId: true },
    });
    if (students.length === 0) return apiErr(404, "دانش‌آموزی از این مدرسه یافت نشد.", "NOT_FOUND");

    const action = String(body.action ?? "");

    if (action === "moveClass") {
      const classId = body.classId ? String(body.classId) : null;
      if (classId) {
        const cls = await db.class.findFirst({ where: { id: classId, schoolId } });
        if (!cls) return apiErr(404, "کلاس هدف یافت نشد.", "CLASS_NOT_FOUND");
        // FIX: انتقال گروهی هم ظرفیت را رعایت می‌کند — فقط تازه‌واردها شمرده می‌شوند
        if (cls.capacity) {
          const alreadyThere = students.filter((s) => s.classId === classId).length;
          const newcomers = students.length - alreadyThere;
          const inTarget = await db.student.count({ where: { classId } });
          if (inTarget + newcomers > cls.capacity) return apiErr(409, "ظرفیت این کلاس تکمیل است.", "CLASS_FULL");
        }
      }
      const res = await db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { classId } });
      await audit({ user: me, action: "عملیات گروهی: انتقال کلاس", entityType: "Student", meta: { count: res.count, classId } });
      return apiOk({ updated: res.count, action });
    }

    if (action === "setStatus") {
      const status = String(body.status ?? "");
      if (!STUDENT_STATUSES.includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
      const res = await db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { status } });
      await audit({ user: me, action: "عملیات گروهی: تغییر وضعیت", entityType: "Student", meta: { count: res.count, status } });
      return apiOk({ updated: res.count, action });
    }

    if (action === "tag") {
      const tagKey = String(body.tagKey ?? "").trim();
      if (!tagKey || tagKey.length > 30) return apiErr(400, "کلید تگ الزامی و حداکثر ۳۰ نویسه است.", "BAD_TAG");
      // اگر تگ تعریف‌نشده باشد، به‌صورت خودکار برای مدرسه تعریف می‌شود (سازگار با تگ آزاد نمای ۳۶۰)
      const tag = await db.tagDef.upsert({
        where: { schoolId_key: { schoolId, key: tagKey } },
        update: {},
        create: { schoolId, key: tagKey, label: tagKey },
      });
      const mode = body.tagMode === "remove" ? "remove" : "add";
      const targetIds = students.map((s) => s.id);
      const fresh = await db.student.findMany({ where: { id: { in: targetIds } }, select: { id: true, tags: true } });
      await db.$transaction(
        fresh.map((s) => {
          let list: string[] = [];
          try { list = JSON.parse(s.tags ?? "[]"); } catch { list = []; }
          if (!Array.isArray(list)) list = [];
          const next = mode === "add" ? Array.from(new Set([...list, tagKey])) : list.filter((k) => k !== tagKey);
          return db.student.update({ where: { id: s.id }, data: { tags: JSON.stringify(next) } });
        })
      );
      await audit({ user: me, action: "عملیات گروهی: تگ", entityType: "Student", meta: { count: fresh.length, tagKey, mode } });
      return apiOk({ updated: fresh.length, action });
    }

    if (action === "house") {
      const houseId = body.houseId ? String(body.houseId) : null;
      if (houseId) {
        const house = await db.house.findFirst({ where: { id: houseId, schoolId } });
        if (!house) return apiErr(404, "این خونه یافت نشد.", "HOUSE_NOT_FOUND");
      }
      const res = await db.student.updateMany({ where: { id: { in: students.map((s) => s.id) } }, data: { houseId } });
      await audit({ user: me, action: "عملیات گروهی: واگذاری خونه", entityType: "Student", meta: { count: res.count, houseId } });
      return apiOk({ updated: res.count, action });
    }

    return apiErr(400, "عملیات گروهی ناشناخته است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

/** GET /api/students/bulk — خروجی CSV فهرست فیلترشده (برای گزارش/بکاپ سبک) */
export async function GET(req: NextRequest) {
  try {
    // خروجی انبوه شامل کد ملی/تلفن است — همان دسترسی POST لازم است
    const me = await requirePermission(req, "manage_students");
    const schoolId = requireSchoolId(me);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const q = searchParams.get("q")?.trim();

    const where: Record<string, unknown> = { schoolId };
    if (classId) where.classId = classId;
    if (q) {
      where.OR = [
        { user: { firstName: { contains: q } } },
        { user: { lastName: { contains: q } } },
        { user: { nationalId: { contains: q } } },
        { studentNumber: { contains: q } },
      ];
    }

    const students = await db.student.findMany({
      where,
      include: {
        user: { select: { nationalId: true, firstName: true, lastName: true, phone: true, shadNumber: true } },
        class: { select: { name: true } },
      },
      orderBy: [{ class: { name: "asc" } }, { user: { lastName: "asc" } }],
      take: 5000,
    });

    const header = ["شماره دانش‌آموزی", "کد ملی", "نام", "نام خانوادگی", "کلاس", "وضعیت", "تلفن", "شاد"];
    const rows = students.map((s) => [
      s.studentNumber,
      s.user.nationalId,
      s.user.firstName,
      s.user.lastName,
      s.class?.name ?? "",
      s.status,
      s.user.phone ?? "",
      s.user.shadNumber ?? "",
    ]);
    // FIX (راند ۱۶): خنثی‌سازی فرمول اکسل — سلول‌های شروع‌شده با = + - @ خطرناک‌اند
    const safeCell = (c: unknown): string => {
      let v = String(c ?? "").replace(/"/g, '""');
      if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
      return `"${v}"`;
    };
    const csv = "\uFEFF" + [header, ...rows].map((r) => r.map(safeCell).join(",")).join("\r\n");

    await audit({ user: me, action: "خروجی CSV دانش‌آموزان", entityType: "Student", meta: { count: students.length, classId: classId ?? null } });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
