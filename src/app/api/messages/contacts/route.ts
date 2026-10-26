import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError } from "@/lib/api";
import { avatarApiFields } from "@/lib/avatar";

/**
 * GET /api/messages/contacts — مخاطبین مجاز
 * دانش‌آموز: معلمان کلاس خودش + مدیر و معاونین
 * ولی: معلمان کلاس فرزند + مدیر و معاونین + فرزندان خودش
 * کارکنان: همه کارکنان مدرسه
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";

    const select = {
      id: true, firstName: true, lastName: true, role: true, shadNumber: true, schoolId: true,
      school: { select: { name: true } },
      profileImageType: true, photoUrl: true, avatarConfig: true,
    };

    const withAvatar = (u: { profileImageType: string | null; photoUrl: string | null; avatarConfig: string | null }) => avatarApiFields(u);

    if (isService) {
      const all = await db.user.findMany({
        where: { isActive: true, id: { not: me.id } },
        select,
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
        take: 500,
      });
      // راند ۱۸: نام مدرسه هم برگردانده می‌شود تا دیالوگ «گفتگوی جدید» بتواند سوپرادمین را
      // در گروه‌های مدرسه‌ای هم دسته‌بندی کند
      return apiOk({ contacts: all.map((c) => ({ ...c, schoolName: c.school?.name ?? null, ...withAvatar(c) })) });
    }

    if (!me.schoolId) return apiOk({ contacts: [] });
    const schoolId = me.schoolId;

    if (me.role === "MANAGER" || me.role === "DEPUTY" || me.role === "TEACHER") {
      const staff = await db.user.findMany({
        where: { isActive: true, schoolId, id: { not: me.id }, role: { in: ["MANAGER", "DEPUTY", "TEACHER"] } },
        select,
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
      });
      return apiOk({ contacts: staff.map((c) => ({ ...c, ...withAvatar(c) })) });
    }

    // دانش‌آموز: معلمان مرتبط با کلاسش
    if (me.role === "STUDENT") {
      const profile = await db.student.findUnique({
        where: { userId: me.id },
        include: { class: { include: { homeroomTeacher: true } } },
      });
      const teacherIds = new Set<string>();
      if (profile?.class) {
        const assignments = await db.teachingAssignment.findMany({
          where: { classId: profile.classId! },
          select: { teacherId: true },
        });
        assignments.forEach((a) => teacherIds.add(a.teacherId));
        if (profile.class.homeroomTeacher) teacherIds.add(profile.class.homeroomTeacher.id);
      }
      const staff = await db.user.findMany({
        where: {
          isActive: true, schoolId,
          OR: [
            { role: { in: ["MANAGER", "DEPUTY"] } },
            { id: { in: [...teacherIds] } },
          ],
        },
        select,
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
      });
      return apiOk({ contacts: staff.map((c) => ({ ...c, ...withAvatar(c) })) });
    }

    // ولی: معلمان کلاس فرزندان + مدیر/معاون + فرزندان
    if (me.role === "PARENT") {
      const kids = await db.studentParent.findMany({
        where: { parentUserId: me.id },
        include: { student: { include: { class: { include: { homeroomTeacher: true } }, user: true } } },
      });
      const teacherIds = new Set<string>();
      const childIds: string[] = [];
      const classIds: string[] = [];
      for (const k of kids) {
        childIds.push(k.student.user.id);
        if (k.student.classId) classIds.push(k.student.classId);
        if (k.student.class?.homeroomTeacher) teacherIds.add(k.student.class.homeroomTeacher.id);
      }
      if (classIds.length) {
        const assignments = await db.teachingAssignment.findMany({
          where: { classId: { in: classIds } },
          select: { teacherId: true },
        });
        assignments.forEach((a) => teacherIds.add(a.teacherId));
      }
      const contacts = await db.user.findMany({
        where: {
          isActive: true, schoolId,
          OR: [
            { role: { in: ["MANAGER", "DEPUTY"] } },
            { id: { in: [...teacherIds] } },
            { id: { in: childIds } },
          ],
        },
        select,
        orderBy: [{ role: "asc" }, { lastName: "asc" }],
      });
      return apiOk({ contacts: contacts.map((c) => ({ ...c, ...withAvatar(c) })) });
    }

    return apiOk({ contacts: [] });
  } catch (e) {
    return handleApiError(e);
  }
}
