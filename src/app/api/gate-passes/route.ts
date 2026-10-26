import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";
import { todayKey } from "@/lib/persian";

/* ============================================================
   بهار | مجوز خروج دانش‌آموز — درخواست ولی/دفتر، تأیید مدیریت،
   ثبت خروج نهایی توسط سرایدار/دفتر
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? todayKey();

    if (STAFF.includes(me.role) || me.role === "TEACHER") {
      const passes = await db.gatePass.findMany({
        where: { schoolId, date },
        include: { student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 300,
      });
      return apiOk({ staff: true, date, passes });
    }

    let studentIds: string[] = [];
    if (me.role === "STUDENT") {
      const st = await db.student.findFirst({ where: { userId: me.id, schoolId }, select: { id: true } });
      if (st) studentIds = [st.id];
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      studentIds = links.map((l) => l.studentId);
    }
    const passes = studentIds.length
      ? await db.gatePass.findMany({
          where: { schoolId, studentId: { in: studentIds } },
          include: { student: { select: { id: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        })
      : [];
    const myStudents = studentIds.length
      ? await db.student.findMany({
          where: { id: { in: studentIds } },
          include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } },
        })
      : [];
    return apiOk({ staff: false, date, passes, myStudentIds: studentIds, myStudents });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ studentId?: string; date?: string; exitTime?: string; reason?: string; pickupBy?: string }>(req);
    const studentId = String(body.studentId ?? "");
    const reason = (body.reason ?? "").trim().slice(0, 300);
    if (!reason) return apiErr(400, "دلیل خروج الزامی است.", "BAD_REASON");

    // دسترسی درخواست‌کننده نسبت به دانش‌آموز
    const student = await db.student.findFirst({ where: { id: studentId, schoolId } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    if (me.role === "PARENT") {
      const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
      if (!link) return apiErr(403, "این دانش‌آموز فرزند شما نیست.", "FORBIDDEN");
    } else if (me.role === "STUDENT") {
      if (student.userId !== me.id) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    } else if (!STAFF.includes(me.role) && me.role !== "TEACHER") {
      return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    }

    const pass = await db.gatePass.create({
      data: {
        schoolId, studentId,
        date: (body.date ?? todayKey()).slice(0, 10),
        exitTime: body.exitTime?.slice(0, 5) || null,
        reason,
        pickupBy: body.pickupBy?.trim().slice(0, 80) || null,
        // درخواست دفتر/مدیریت از همان ابتدا تأییدشده است؛ درخواست ولی منتظر تأیید می‌ماند
        status: STAFF.includes(me.role) ? "APPROVED" : "PENDING",
        requestedById: me.id,
        decidedById: STAFF.includes(me.role) ? me.id : null,
      },
    });
    await audit({ user: me, action: "ثبت مجوز خروج", entityType: "GatePass", entityId: pass.id, schoolId });
    return apiOk({ pass });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ id?: string; status?: string }>(req);
    const status = String(body.status ?? "");
    if (!["APPROVED", "REJECTED", "EXITED"].includes(status)) return apiErr(400, "وضعیت نامعتبر است.", "BAD_STATUS");
    const pass = await db.gatePass.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
    if (!pass) return apiErr(404, "مجوز یافت نشد.", "NOT_FOUND");
    if (status === "EXITED" && pass.status !== "APPROVED") return apiErr(409, "فقط مجوز تأییدشده قابل ثبت خروج است.", "BAD_STATE");
    if ((status === "APPROVED" || status === "REJECTED") && pass.status !== "PENDING") return apiErr(409, "این مجوز قبلاً تعیین تکلیف شده است.", "BAD_STATE");
    const updated = await db.gatePass.update({ where: { id: pass.id }, data: { status, decidedById: me.id } });
    await audit({ user: me, action: `مجوز خروج: ${status}`, entityType: "GatePass", entityId: pass.id, schoolId });
    return apiOk({ pass: updated });
  } catch (e) {
    return handleApiError(e);
  }
}
