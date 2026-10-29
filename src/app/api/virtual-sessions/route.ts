import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor, demoWriteBlock} from "@/lib/api";

/* ============================================================
   بهار | کلاس مجازی — زمان‌بندی جلسه‌های آنلاین (اسکای‌روم،
   بیگ‌بلوباتن، شاد و…) روی برنامهٔ مدرسه، بدون پشتهٔ ویدیو
   ============================================================ */

const PROVIDERS = ["SKYROOM", "BBB", "SHAD", "OTHER"] as const;
const CREATORS = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const since = new Date(Date.now() - 2 * 3600_000);
    const all = await db.virtualSession.findMany({
      where: { schoolId, startsAt: { gte: since } },
      orderBy: { startsAt: "asc" },
      take: 200,
    });
    const classIds = [...new Set(all.map((s) => s.classId).filter((x): x is string => !!x))];
    const subjectIds = [...new Set(all.map((s) => s.subjectId).filter((x): x is string => !!x))];
    const [classes, subjects] = await Promise.all([
      classIds.length ? db.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } }) : [],
      subjectIds.length ? db.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } }) : [],
    ]);
    const className = new Map<string, string>(classes.map((c) => [c.id, c.name] as [string, string]));
    const subjectName = new Map<string, string>(subjects.map((s) => [s.id, s.name] as [string, string]));

    let visible = all;
    if (me.role === "STUDENT") {
      const st = await db.student.findFirst({ where: { userId: me.id, schoolId }, select: { classId: true } });
      visible = all.filter((s) => !s.classId || s.classId === st?.classId);
    } else if (me.role === "PARENT") {
      const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
      const kids = links.length
        ? await db.student.findMany({ where: { id: { in: links.map((l) => l.studentId) } }, select: { classId: true } })
        : [];
      const kidClasses = new Set(kids.map((k) => k.classId));
      visible = all.filter((s) => !s.classId || kidClasses.has(s.classId));
    }
    return apiOk({
      sessions: visible.map((s) => ({
        ...s,
        className: s.classId ? className.get(s.classId) ?? null : null,
        subjectName: s.subjectId ? subjectName.get(s.subjectId) ?? null : null,
        mine: s.createdById === me.id,
      })),
      canCreate: CREATORS.includes(me.role),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, CREATORS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{
      title?: string; link?: string; startsAt?: string; durationMin?: number;
      provider?: string; classId?: string; subjectId?: string;
    }>(req);
    const title = (body.title ?? "").trim().slice(0, 120);
    const link = (body.link ?? "").trim().slice(0, 500);
    if (!title) return apiErr(400, "عنوان جلسه الزامی است.", "BAD_TITLE");
    if (!/^https?:\/\//i.test(link)) return apiErr(400, "لینک جلسه باید با http شروع شود.", "BAD_LINK");
    const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
    if (Number.isNaN(startsAt.getTime())) return apiErr(400, "زمان جلسه نامعتبر است.", "BAD_TIME");
    if (body.classId) {
      const cls = await db.class.findFirst({ where: { id: body.classId, schoolId }, select: { id: true } });
      if (!cls) return apiErr(404, "کلاس یافت نشد.", "NO_CLASS");
    }
    const session = await db.virtualSession.create({
      data: {
        schoolId,
        title, link, startsAt,
        durationMin: Math.min(480, Math.max(5, Math.round(body.durationMin ?? 45))),
        provider: PROVIDERS.includes(body.provider as (typeof PROVIDERS)[number]) ? String(body.provider) : "SKYROOM",
        classId: body.classId || null,
        subjectId: body.subjectId || null,
        createdById: me.id,
      },
    });
    await audit({ user: me, action: "ساخت جلسه کلاس مجازی", entityType: "VirtualSession", entityId: session.id, schoolId });
    return apiOk({ session });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, CREATORS);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const id = new URL(req.url).searchParams.get("id") ?? "";
    const session = await db.virtualSession.findFirst({ where: { id, schoolId } });
    if (!session) return apiErr(404, "جلسه یافت نشد.", "NOT_FOUND");
    if (me.role === "TEACHER" && session.createdById !== me.id) return apiErr(403, "فقط سازنده می‌تواند حذف کند.", "FORBIDDEN");
    await db.virtualSession.delete({ where: { id: session.id } });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
