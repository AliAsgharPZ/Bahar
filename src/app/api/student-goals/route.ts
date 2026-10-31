import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, requireSchoolId, demoWriteBlock } from "@/lib/api";

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"] as const;
const METRICS = ["GPA", "ATTENDANCE", "BEHAVIOR", "CUSTOM"] as const;
const STATUSES = ["ACTIVE", "ACHIEVED", "DROPPED"] as const;

/**
 * GET /api/student-goals?studentId= — روی همان مدل هدف‌های پروفایل ۳۶۰؛ این‌جا نمای اختصاصی هدف‌گذاری است
 * POST / PATCH — ساختن هدف و ثبت پیشرفت (مقدار فعلی/وضعیت)
 */
async function visibleStudentIds(me: { id: string; role: string }): Promise<string[] | "ALL"> {
  if ((STAFF as readonly string[]).includes(me.role)) return "ALL";
  if (me.role === "STUDENT") {
    const p = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
    return p ? [p.id] : [];
  }
  const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
  return links.map((l) => l.studentId);
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = requireSchoolId(me);
    const visible = await visibleStudentIds(me);
    const want = req.nextUrl.searchParams.get("studentId");
    const scope = visible === "ALL" ? (want ? [want] : null) : visible.filter((id) => !want || id === want);
    const rows = await db.studentGoal.findMany({
      where: {
        student: { schoolId },
        ...(scope ? { studentId: { in: scope } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { student: { select: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } } },
    });
    return apiOk({
      isStaff: visible === "ALL",
      items: rows.map((g) => ({
        id: g.id, studentId: g.studentId, title: g.title, metric: g.metric,
        targetValue: g.targetValue, currentValue: g.currentValue, status: g.status,
        dueDate: g.dueDate, note: g.note,
        studentName: `${g.student.user.firstName} ${g.student.user.lastName}`,
        className: g.student.class?.name ?? null,
      })),
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
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ studentId?: string; title?: string; metric?: string; targetValue?: string; note?: string }>(req);
    const title = String(body.title ?? "").trim();
    if (!title) return apiErr(400, "عنوان هدف لازم است.", "BAD_INPUT");
    const visible = await visibleStudentIds(me);
    let studentId = body.studentId ? String(body.studentId) : "";
    if (me.role === "STUDENT") studentId = visible !== "ALL" ? visible[0] ?? "" : "";
    if (!studentId) return apiErr(400, "دانش‌آموز مشخص نیست.", "BAD_INPUT");
    if (visible !== "ALL" && !visible.includes(studentId)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const student = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
    if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const metric = body.metric && (METRICS as readonly string[]).includes(body.metric) ? body.metric : "CUSTOM";
    const created = await db.studentGoal.create({
      data: {
        studentId, title, metric,
        targetValue: body.targetValue ? String(body.targetValue).trim() : null,
        note: body.note ? String(body.note).trim() : null,
      },
    });
    return apiOk({ id: created.id });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ id?: string; currentValue?: string; status?: string }>(req);
    const found = await db.studentGoal.findFirst({ where: { id: String(body.id ?? "") }, include: { student: { select: { schoolId: true } } } });
    if (!found || found.student.schoolId !== requireSchoolId(me)) return apiErr(404, "هدف یافت نشد.", "NOT_FOUND");
    const visible = await visibleStudentIds(me);
    if (visible !== "ALL" && !visible.includes(found.studentId)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const status = body.status && (STATUSES as readonly string[]).includes(body.status) ? body.status : found.status;
    const updated = await db.studentGoal.update({
      where: { id: found.id },
      data: {
        status,
        currentValue: body.currentValue !== undefined ? String(body.currentValue).trim() || null : found.currentValue,
      },
    });
    return apiOk({ id: updated.id, status: updated.status });
  } catch (e) {
    return handleApiError(e);
  }
}
