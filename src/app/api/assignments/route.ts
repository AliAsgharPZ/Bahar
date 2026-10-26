import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser, actingSchoolIdFor } from "@/lib/api";

/** GET /api/assignments?classId=&mine=1 — تکالیف */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const mine = searchParams.get("mine") === "1";
    const schoolId = me.schoolId;

    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({ where: { userId: me.id }, select: { classId: true } });
      if (!profile?.classId) return apiOk({ assignments: [] });
      const assignments = await db.assignment.findMany({
        where: { classId: profile.classId },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
        orderBy: { dueDate: "desc" },
      });
      return apiOk({ assignments });
    }

    if (me.role === "PARENT") {
      const children = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: { student: { select: { classId: true } } },
      });
      const classIds = children.map((c) => c.student.classId).filter(Boolean) as string[];
      if (classIds.length === 0) return apiOk({ assignments: [] });
      const assignments = await db.assignment.findMany({
        where: { classId: { in: classIds } },
        include: {
          subject: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
          class: { select: { name: true } },
        },
        orderBy: { dueDate: "desc" },
      });
      return apiOk({ assignments });
    }

    // کارکنان
    const actingSchoolId = actingSchoolIdFor(req, me);
    const scopeSchoolId = me.schoolId ?? actingSchoolId;
    if (me.role === "ADMIN" && !scopeSchoolId) {
      // ادمین سرویس فقط داخل پنل مدرسه به تکالیف همان مدرسه دسترسی دارد
      return apiOk({ assignments: [] });
    }
    const where: Record<string, unknown> = {};
    if (scopeSchoolId) {
      const classes = await db.class.findMany({ where: { schoolId: scopeSchoolId }, select: { id: true } });
      const ids = classes.map((c) => c.id);
      // ⚠ فیلتر classId باید «درون» محدوده مدرسه بماند — جایگزین کردن آن یعنی نشت داده مدرسه دیگر (IDOR)
      where.classId = { in: classId ? (ids.includes(classId) ? [classId] : []) : ids };
    } else if (classId) {
      where.classId = classId; // فقط سوپرادمین (بدون مدرسه) به این شاخه می‌رسد
    }
    if (mine && me.role === "TEACHER") where.teacherId = me.id;

    const assignments = await db.assignment.findMany({
      where,
      include: {
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
        class: { select: { name: true, grade: true } },
      },
      orderBy: { dueDate: "desc" },
      take: 300,
    });
    return apiOk({ assignments });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/assignments — ایجاد تکلیف */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_assignments");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<Record<string, string>>(req);

    const classId = String(body.classId ?? "");
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    const dueDate = String(body.dueDate ?? "");
    if (!classId || title.length < 2 || !description || !dueDate) {
      return apiErr(400, "کلاس، عنوان، توضیح و مهلت الزامی است.", "BAD_INPUT");
    }
    const due = new Date(dueDate);
    if (isNaN(due.getTime())) return apiErr(400, "تاریخ مهلت نامعتبر است.", "BAD_DATE");

    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");

    let subjectId: string | null = body.subjectId ? String(body.subjectId) : null;
    if (subjectId) {
      const subject = await db.subject.findUnique({ where: { id: subjectId } });
      if (!subject || subject.schoolId !== schoolId) return apiErr(400, "درس نامعتبر است.", "BAD_SUBJECT");
    }
    // FIX (راند ۱۶): معلم فقط برای کلاس‌هایی که درسی در آن‌ها دارد یا مشاور آن است تکلیف می‌سازد
    // — قبلاً با حذف subjectId چک دور می‌زد
    if (me.role === "TEACHER") {
      const assigned = await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId } });
      if (!assigned && cls.homeroomTeacherId !== me.id) {
        return apiErr(403, "شما معلم یا مشاور این کلاس نیستید.", "FORBIDDEN");
      }
    }

    const assignment = await db.assignment.create({
      data: { classId, subjectId, teacherId: me.id, title, description, dueDate: due },
    });
    await audit({ user: me, action: "CREATE_ASSIGNMENT", entityType: "ASSIGNMENT", entityId: assignment.id, schoolId });
    return apiOk({ assignment });
  } catch (e) {
    return handleApiError(e);
  }
}
