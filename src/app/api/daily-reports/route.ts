import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | گزارش روزانهٔ پیش‌دبستانی + تحویل امن — مربی برای هر
   کودک گزارش روز (خوراک، خواب، خلق، دارو، یادداشت) ثبت
   می‌کند؛ ولی همان روز می‌خواند و افراد مجاز به تحویل کودک
   را مدیریت می‌کند.
   ============================================================ */

const STAFF = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];
const MOODS = ["GREAT", "GOOD", "CALM", "UPSET", "SICK"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId") ?? "";
    const date = url.searchParams.get("date") ?? "";

    if (me.role === "STUDENT" || me.role === "PARENT") {
      const allowed = me.role === "STUDENT"
        ? [(await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id]
        : (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
      const target = studentId && allowed.includes(studentId) ? studentId : allowed[0];
      if (!target) return apiOk({ reports: [], pickups: [] });
      const [reports, pickups] = await Promise.all([
        db.dailyReport.findMany({ where: { studentId: target }, orderBy: { date: "desc" }, take: 30 }),
        db.pickupPerson.findMany({ where: { studentId: target }, orderBy: { createdAt: "asc" } }),
      ]);
      return apiOk({ reports, pickups });
    }

    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    if (studentId) {
      const [reports, pickups] = await Promise.all([
        db.dailyReport.findMany({ where: { studentId, schoolId }, orderBy: { date: "desc" }, take: 30 }),
        db.pickupPerson.findMany({ where: { studentId, schoolId }, orderBy: { createdAt: "asc" } }),
      ]);
      return apiOk({ reports, pickups });
    }
    if (!date) return apiOk({ reports: [] });
    const reports = await db.dailyReport.findMany({
      where: { schoolId, date },
      include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
    });
    return apiOk({
      reports: reports.map((r) => ({
        ...r,
        studentName: `${r.student.user.firstName} ${r.student.user.lastName}`,
        className: r.student.class?.name ?? "",
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{
      action?: string; studentId?: string; date?: string; meals?: string; napMin?: number;
      mood?: string; medication?: string; note?: string; name?: string; relation?: string;
      phone?: string; id?: string; isAuthorized?: boolean;
    }>(req);

    if (body.action === "addPickup" || body.action === "removePickup") {
      // ولی برای فرزند خودش؛ کادر برای هر دانش‌آموز مدرسه
      const studentId = String(body.studentId ?? "");
      const st = await db.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true, userId: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const mine = me.role === "PARENT"
        ? !!(await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } }))
        : STAFF.includes(me.role) && (!me.schoolId || me.schoolId === st.schoolId);
      if (!mine) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (body.action === "removePickup") {
        await db.pickupPerson.deleteMany({ where: { id: String(body.id ?? ""), studentId } });
        return apiOk({ ok: true });
      }
      const name = (body.name ?? "").trim();
      if (name.length < 3) return apiErr(400, "نام فرد مجاز را بنویسید.", "BAD_INPUT");
      const p = await db.pickupPerson.create({
        data: {
          schoolId: st.schoolId, studentId, name: name.slice(0, 80),
          relation: (body.relation ?? "سایر").trim().slice(0, 40),
          phone: body.phone?.trim().slice(0, 20) || null,
        },
      });
      return apiOk({ pickup: p });
    }

    // ثبت گزارش روزانه: فقط کادر
    await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const studentId = String(body.studentId ?? "");
    const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const date = String(body.date ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiErr(400, "تاریخ روز را مثل 1405-08-05 بنویسید.", "BAD_DATE");
    const mood = MOODS.includes(body.mood ?? "") ? body.mood! : "GOOD";
    const report = await db.dailyReport.upsert({
      where: { studentId_date: { studentId, date } },
      create: {
        schoolId, studentId, date,
        meals: (body.meals ?? "").trim().slice(0, 500),
        napMin: body.napMin != null ? Math.min(600, Math.max(0, Math.round(body.napMin))) : null,
        mood, medication: body.medication?.trim().slice(0, 200) || null,
        note: body.note?.trim().slice(0, 500) || null, createdById: me.id,
      },
      update: {
        meals: (body.meals ?? "").trim().slice(0, 500),
        napMin: body.napMin != null ? Math.min(600, Math.max(0, Math.round(body.napMin))) : null,
        mood, medication: body.medication?.trim().slice(0, 200) || null,
        note: body.note?.trim().slice(0, 500) || null,
      },
    });
    return apiOk({ report });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.dailyReport.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.dailyReport.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
