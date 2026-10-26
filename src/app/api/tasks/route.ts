import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, requireSchoolId } from "@/lib/api";
import { suggestTaskPriority } from "@/lib/insights";

const STATUSES = ["TODO", "IN_PROGRESS", "DONE", "CANCELED"];
const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

/** GET /api/tasks — تسک‌ها با فیلتر مسئول/وضعیت/اولویت (بورد داخلی کارکنان) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const schoolId = requireSchoolId(me);
    const url = new URL(req.url);
    const status = url.searchParams.get("status");
    const mine = url.searchParams.get("mine") === "1";
    const where: Record<string, unknown> = { schoolId };
    if (status && STATUSES.includes(status)) where.status = status;
    if (mine) where.assigneeId = me.id;

    const [tasks, members] = await Promise.all([
      db.task.findMany({
        where,
        orderBy: [{ status: "desc" }, { priority: "desc" }, { dueDate: "asc" }],
        take: 200,
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, role: true } },
          creator: { select: { firstName: true, lastName: true } },
          student: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      }),
      db.user.findMany({
        where: { schoolId, role: { in: ["MANAGER", "DEPUTY", "TEACHER"] }, isActive: true },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
    ]);
    return apiOk({ tasks, members, canManage: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role) });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/tasks — تسک جدید (با پیشنهاد اولویت خودکار) */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      title: string;
      description?: string;
      priority?: string;
      dueDate?: string;
      assigneeId?: string;
      studentId?: string;
      classId?: string;
      sourceKind?: string;
      sourceId?: string;
    }>(req);
    if (!body.title?.trim()) return apiErr(400, "عنوان تسک لازم است.", "BAD_REQUEST");
    // مسئول باید کارمند فعال همان مدرسه باشد
    if (body.assigneeId) {
      const assignee = await db.user.findFirst({
        where: { id: body.assigneeId, schoolId, role: { in: ["MANAGER", "DEPUTY", "TEACHER"] }, isActive: true },
        select: { id: true },
      });
      if (!assignee) return apiErr(400, "مسؤول انتخاب‌شده معتبر نیست.", "BAD_ASSIGNEE");
    }
    // دانش‌آموز مرتبط باید در همان مدرسه باشد
    if (body.studentId) {
      const st = await db.student.findFirst({ where: { id: body.studentId, schoolId }, select: { id: true } });
      if (!st) return apiErr(400, "دانش‌آموز مرتبط در این مدرسه یافت نشد.", "BAD_STUDENT");
    }
    if (body.classId) {
      const cl = await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } });
      if (!cl) return apiErr(400, "کلاس مرتبط در این مدرسه یافت نشد.", "BAD_CLASS");
    }
    const due = body.dueDate ? new Date(body.dueDate) : null;
    const suggested = suggestTaskPriority(due, (body.priority as "LOW" | "NORMAL" | "HIGH") ?? "NORMAL");
    const task = await db.task.create({
      data: {
        schoolId,
        title: body.title.trim(),
        description: body.description ?? null,
        priority: PRIORITIES.includes(body.priority ?? "") ? body.priority! : suggested,
        dueDate: due && !isNaN(due.getTime()) ? due : null,
        assigneeId: body.assigneeId || null,
        createdById: me.id,
        studentId: body.studentId || null,
        classId: body.classId || null,
        sourceKind: body.sourceKind ?? "MANUAL",
        sourceId: body.sourceId ?? null,
      },
    });
    await audit({ user: me, action: "ایجاد تسک", entityType: "Task", entityId: task.id, schoolId, meta: { title: body.title } });
    return apiOk({ task, suggestedPriority: suggested });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/tasks — تغییر وضعیت/ویرایش (کانبان drag) */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{
      id: string;
      status?: string;
      priority?: string;
      assigneeId?: string | null;
      dueDate?: string | null;
      title?: string;
      description?: string;
    }>(req);
    const task = await db.task.findUnique({ where: { id: body.id } });
    if (!task) return apiErr(404, "تسک یافت نشد.", "NOT_FOUND");
    if (task.schoolId !== me.schoolId && me.role !== "SUPER_ADMIN") return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    // فقط مسئول یا مدیر می‌تواند وضعیت را عوض کند
    const isOwner = task.assigneeId === me.id;
    const isManager = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role);
    if (body.status && !isOwner && !isManager) return apiErr(403, "فقط مسئول تسک یا مدیر می‌تواند وضعیت را تغییر دهد.", "FORBIDDEN");
    // سایر فیلدها (اولویت/مسؤول/عنوان/توضیح/مهلت) فقط برای مدیر
    const structuralChange =
      body.priority !== undefined || body.assigneeId !== undefined || body.title !== undefined ||
      body.description !== undefined || body.dueDate !== undefined;
    if (structuralChange && !isManager && task.createdById !== me.id) {
      return apiErr(403, "ویرایش جزئیات تسک فقط برای مدیر یا سازنده تسک مجاز است.", "FORBIDDEN");
    }
    // مسؤول جدید باید کارمند فعال همان مدرسه باشد
    if (body.assigneeId) {
      const assignee = await db.user.findFirst({
        where: { id: body.assigneeId, schoolId: task.schoolId, role: { in: ["MANAGER", "DEPUTY", "TEACHER"] }, isActive: true },
        select: { id: true },
      });
      if (!assignee) return apiErr(400, "مسؤول انتخاب‌شده معتبر نیست.", "BAD_ASSIGNEE");
    }

    const data: Record<string, unknown> = {};
    if (body.status && STATUSES.includes(body.status)) {
      data.status = body.status;
      data.doneAt = body.status === "DONE" ? new Date() : null;
    }
    if (body.priority && PRIORITIES.includes(body.priority)) data.priority = body.priority;
    if (body.assigneeId !== undefined) data.assigneeId = body.assigneeId || null;
    if (body.title?.trim()) data.title = body.title.trim();
    if (body.description !== undefined) data.description = body.description;
    if (body.dueDate !== undefined) {
      const d = body.dueDate ? new Date(body.dueDate) : null;
      data.dueDate = d && !isNaN(d.getTime()) ? d : null;
    }
    const updated = await db.task.update({ where: { id: body.id }, data });
    await audit({ user: me, action: "ویرایش تسک", entityType: "Task", entityId: task.id, meta: { status: body.status } });
    return apiOk({ task: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/tasks?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiErr(400, "شناسه لازم است.", "BAD_REQUEST");
    const task = await db.task.findUnique({ where: { id } });
    if (!task) return apiErr(404, "تسک یافت نشد.", "NOT_FOUND");
    if (task.schoolId !== me.schoolId && me.role !== "SUPER_ADMIN") return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    if (!["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"].includes(me.role) && task.createdById !== me.id) {
      return apiErr(403, "فقط سازنده یا مدیر می‌تواند حذف کند.", "FORBIDDEN");
    }
    await db.task.delete({ where: { id } });
    await audit({ user: me, action: "حذف تسک", entityType: "Task", entityId: id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
