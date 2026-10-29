import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor, demoWriteBlock } from "@/lib/api";

/* ============================================================
   بهار | باشگاه‌ها و فوق‌برنامه — کاتالوگ کلاس‌های فوق‌برنامه
   با ظرفیت و بازهٔ پایه؛ دانش‌آموز/ولی ثبت‌نام می‌کند (با
   لیست انتظار خودکار وقتی ظرفیت پر است) و کادر فهرست هر
   باشگاه را می‌بیند.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    let schoolId: string | null = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    let myStudentId: string | null = null;
    if (me.role === "STUDENT") {
      const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true, schoolId: true } });
      myStudentId = st?.id ?? null;
      schoolId = st?.schoolId ?? schoolId;
    } else if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id }, select: { student: { select: { schoolId: true } } } });
      schoolId = link?.student.schoolId ?? schoolId;
    }
    if (!schoolId) return apiOk({ clubs: [] });
    const clubs = await db.club.findMany({
      where: { schoolId },
      include: { _count: { select: { enrollments: { where: { status: "ENROLLED" } } } } },
      orderBy: [{ weekday: "asc" }, { name: "asc" }],
    });
    const myEnrollments = me.role === "STUDENT" || me.role === "PARENT"
      ? await db.clubEnrollment.findMany({
          where: {
            club: { schoolId },
            ...(me.role === "STUDENT" && myStudentId ? { studentId: myStudentId } : {}),
            ...(me.role === "PARENT"
              ? { studentId: { in: (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId) } }
              : {}),
          },
          select: { clubId: true, studentId: true, status: true },
        })
      : [];
    return apiOk({
      clubs: clubs.map((c) => ({ ...c, enrolledCount: c._count.enrollments })),
      myEnrollments,
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
    const body = await readJson<{
      action?: string; id?: string; name?: string; coach?: string; weekday?: number;
      timeLabel?: string; capacity?: number; minGrade?: string; maxGrade?: string;
      fee?: number; clubId?: string; studentId?: string;
    }>(req);

    if (body.action === "create") {
      await requireUser(req, STAFF);
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
      if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
      const name = (body.name ?? "").trim();
      if (name.length < 2) return apiErr(400, "نام باشگاه را بنویسید.", "BAD_INPUT");
      const club = await db.club.create({
        data: {
          schoolId, name: name.slice(0, 100), coach: body.coach?.trim().slice(0, 80) || null,
          weekday: Math.min(7, Math.max(1, Math.round(body.weekday ?? 1))),
          timeLabel: body.timeLabel?.trim().slice(0, 40) || null,
          capacity: Math.min(500, Math.max(1, Math.round(body.capacity ?? 30))),
          minGrade: body.minGrade?.trim().slice(0, 20) || null,
          maxGrade: body.maxGrade?.trim().slice(0, 20) || null,
          fee: Math.max(0, Math.round(body.fee ?? 0)),
        },
      });
      return apiOk({ club });
    }

    if (body.action === "toggle") {
      await requireUser(req, STAFF);
      const club = await db.club.findUnique({ where: { id: String(body.id ?? "") }, select: { id: true, isActive: true, schoolId: true } });
      if (!club || (me.schoolId && me.schoolId !== club.schoolId)) return apiErr(404, "باشگاه یافت نشد.", "NOT_FOUND");
      await db.club.update({ where: { id: club.id }, data: { isActive: !club.isActive } });
      return apiOk({ ok: true });
    }

    if (body.action === "enroll" || body.action === "drop") {
      // دانش‌آموز برای خودش؛ ولی برای فرزندش؛ کادر برای هر دانش‌آموز مدرسه
      const club = await db.club.findUnique({ where: { id: String(body.clubId ?? "") } });
      if (!club || !club.isActive) return apiErr(404, "باشگاه یافت نشد یا غیرفعال است.", "NOT_FOUND");
      let studentId = String(body.studentId ?? "");
      if (me.role === "STUDENT") {
        const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
        studentId = st?.id ?? "";
      } else if (me.role === "PARENT") {
        const ok = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
        if (!ok) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      } else if (!STAFF.includes(me.role) || (me.schoolId && me.schoolId !== club.schoolId)) {
        return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      }
      const st = await db.student.findFirst({ where: { id: studentId, schoolId: club.schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      if (body.action === "drop") {
        await db.clubEnrollment.deleteMany({ where: { clubId: club.id, studentId } });
        return apiOk({ ok: true });
      }
      const count = await db.clubEnrollment.count({ where: { clubId: club.id, status: "ENROLLED" } });
      const status = count >= club.capacity ? "WAITLIST" : "ENROLLED";
      const enr = await db.clubEnrollment.upsert({
        where: { clubId_studentId: { clubId: club.id, studentId } },
        create: { clubId: club.id, studentId, status },
        update: { status },
      });
      // FIX (الگوی خوابگاه): شمارش پس از upsert — ثبت‌نامِ هم‌زمانِ بیش از ظرفیت، به لیست انتظار برمی‌گردد
      if (status === "ENROLLED") {
        const after = await db.clubEnrollment.count({ where: { clubId: club.id, status: "ENROLLED" } });
        if (after > club.capacity) {
          const waitlisted = await db.clubEnrollment.update({
            where: { clubId_studentId: { clubId: club.id, studentId } },
            data: { status: "WAITLIST" },
          });
          return apiOk({ enrollment: waitlisted, waitlisted: true });
        }
      }
      return apiOk({ enrollment: enr, waitlisted: status === "WAITLIST" });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.club.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.club.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
