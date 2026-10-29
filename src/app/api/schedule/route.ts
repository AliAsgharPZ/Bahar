import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import {
  requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser, demoWriteBlock} from "@/lib/api";

/**
 * GET /api/schedule?classId= — برنامه هفتگی
 * - کارکنان: هر کلاس مدرسه
 * - دانش‌آموز: کلاس خودش
 * - معلم: بدون classId → برنامه خودش
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    let classId = searchParams.get("classId");

    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
      classId = profile?.classId ?? null;
    } else if (me.role === "PARENT") {
      const childId = searchParams.get("childId");
      if (childId) {
        const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId: childId } });
        if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
        const child = await db.student.findUnique({ where: { id: childId }, select: { classId: true } });
        classId = child?.classId ?? null;
      } else {
        return apiOk({ slots: [] });
      }
    } else if (me.role === "TEACHER" && !classId) {
      const slots = await db.scheduleSlot.findMany({
        where: { teacherId: me.id },
        include: {
          class: { select: { id: true, name: true, grade: true } },
          subject: { select: { id: true, name: true } },
        },
        orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
      });
      return apiOk({ slots, scope: "teacher" });
    }

    if (!classId) return apiOk({ slots: [], scope: "class" });

    // اعتبارسنجی دامنه
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    if (!isService && me.schoolId && cls.schoolId !== me.schoolId) {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }

    const slots = await db.scheduleSlot.findMany({
      where: { classId },
      include: {
        subject: { select: { id: true, name: true } },
        teacher: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    });
    return apiOk({ slots, scope: "class", class: { id: cls.id, name: cls.name, grade: cls.grade } });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/schedule — ذخیره کامل برنامه یک کلاس */
export async function PUT(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_schedule");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      classId?: string;
      slots?: Array<{ dayOfWeek?: number; period?: number; subjectId?: string | null; teacherId?: string | null; note?: string | null }>;
    }>(req);

    const classId = String(body.classId ?? "");
    if (!classId) return apiErr(400, "کلاس را انتخاب کنید.", "BAD_INPUT");
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    const slots = Array.isArray(body.slots) ? body.slots : [];
    for (const s of slots) {
      if (!s.dayOfWeek || !s.period || s.dayOfWeek < 1 || s.dayOfWeek > 7 || s.period < 1 || s.period > 8) {
        return apiErr(400, "روز یا زنگ نامعتبر است.", "BAD_SLOT");
      }
      if (s.teacherId) {
        const t = await db.user.findUnique({ where: { id: s.teacherId } });
        if (!t || t.schoolId !== schoolId) return apiErr(400, "معلم نامعتبر است.", "BAD_TEACHER");
      }
      if (s.subjectId) {
        const sub = await db.subject.findUnique({ where: { id: s.subjectId } });
        if (!sub || sub.schoolId !== schoolId) return apiErr(400, "درس نامعتبر است.", "BAD_SUBJECT");
      }
    }

    // جایگزینی کامل
    await db.$transaction([
      db.scheduleSlot.deleteMany({ where: { classId } }),
      ...slots.map((s) =>
        db.scheduleSlot.create({
          data: {
            classId,
            dayOfWeek: Number(s.dayOfWeek),
            period: Number(s.period),
            subjectId: s.subjectId || null,
            teacherId: s.teacherId || null,
            note: s.note || null,
          },
        })
      ),
    ]);

    await audit({ user: me, action: "SAVE_SCHEDULE", entityType: "CLASS", entityId: classId, meta: { slots: slots.length }, schoolId });
    return apiOk({ ok: true, count: slots.length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.scheduleSlot.findUnique({ where: { id }, select: { teacherId: true, class: { select: { schoolId: true } } } });
    if (!row) return apiErr(404, "خانهٔ برنامه یافت نشد.", "NOT_FOUND");
    const inSchool = me.schoolId && row.class.schoolId === me.schoolId;
    if (!inSchool && row.teacherId !== me.id && !["SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.scheduleSlot.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
