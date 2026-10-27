import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson } from "@/lib/api";
import { todayKey, jalaliToDate, toJalaliKey } from "@/lib/persian";

/* ============================================================
   بهار | برنامهٔ مطالعه و زنجیرهٔ عادت — دانش‌آموز برای هر
   روز کارهای مطالعه‌اش را می‌نویسد، انجام‌شده می‌زند و
   «زنجیره» (روزهای پیاپی مطالعه) و مجموع دقایق هفته را
   می‌بیند؛ ولی و معلم هم پیشرفت او را دنبال می‌کنند.
   ============================================================ */

async function resolveStudentId(me: { id: string; role: string }, param: string): Promise<string> {
  if (me.role === "STUDENT") {
    return (await db.student.findUnique({ where: { userId: me.id }, select: { id: true } }))?.id ?? "";
  }
  if (me.role === "PARENT") {
    const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
    return param && links.some((l) => l.studentId === param) ? param : (links[0]?.studentId ?? "");
  }
  return param;
}

/** کلیدهای تاریخ سامانه با «-» جدا می‌شوند (1405-08-05)؛ parseJalaliInput فقط «/» می‌فهمد */
function parseKey(key: string): { y: number; m: number; d: number } | null {
  const parts = key.replace(/\//g, "-").split("-").map((p) => Number(p));
  if (parts.length !== 3 || parts.some((p) => !p)) return null;
  return { y: parts[0], m: parts[1], d: parts[2] };
}

function dayDiff(aKey: string, bKey: string): number {
  const a = parseKey(aKey);
  const b = parseKey(bKey);
  if (!a || !b) return 9999;
  return Math.round((jalaliToDate(a.y, a.m, a.d).getTime() - jalaliToDate(b.y, b.m, b.d).getTime()) / 86400000);
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const url = new URL(req.url);
    const studentId = await resolveStudentId(me, url.searchParams.get("studentId") ?? "");
    if (!studentId) return apiOk({ tasks: [], streak: 0, weekMinutes: 0, today: todayKey() });
    const date = url.searchParams.get("date") ?? todayKey();
    const [tasks, doneTasks] = await Promise.all([
      db.studyTask.findMany({ where: { studentId, date }, orderBy: { createdAt: "asc" } }),
      db.studyTask.findMany({ where: { studentId, done: true }, select: { date: true, minutes: true } }),
    ]);
    // زنجیره: روزهای پیاپی (تا امروز یا دیروز) که دست‌کم یک کار انجام‌شده دارند
    const doneDays = new Set(doneTasks.map((t) => t.date));
    let streak = 0;
    let cursor = todayKey();
    if (!doneDays.has(cursor)) {
      // امروز هنوز کاری انجام نشده؛ زنجیره از دیروز شمرده می‌شود تا نشکند
      const p = parseKey(cursor);
      if (p) {
        const y = new Date(jalaliToDate(p.y, p.m, p.d).getTime() - 86400000);
        cursor = toJalaliKey(y);
      }
    }
    while (doneDays.has(cursor)) {
      streak += 1;
      const p = parseKey(cursor);
      if (!p) break;
      const prev = new Date(jalaliToDate(p.y, p.m, p.d).getTime() - 86400000);
      cursor = toJalaliKey(prev);
    }
    const weekMinutes = doneTasks
      .filter((t) => { const d = dayDiff(todayKey(), t.date); return d >= 0 && d < 7; })
      .reduce((s, t) => s + t.minutes, 0);
    return apiOk({ tasks, streak, weekMinutes, today: todayKey(), date });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{ action?: string; id?: string; title?: string; minutes?: number; date?: string; studentId?: string }>(req);
    const studentId = await resolveStudentId(me, String(body.studentId ?? ""));
    if (!studentId) return apiErr(400, "دانش‌آموز مشخص نیست.", "NO_STUDENT");
    const st = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");

    if (body.action === "add") {
      const title = (body.title ?? "").trim();
      if (title.length < 2) return apiErr(400, "عنوان کار را بنویسید.", "BAD_INPUT");
      const task = await db.studyTask.create({
        data: {
          schoolId: st.schoolId, studentId, date: body.date ?? todayKey(),
          title: title.slice(0, 160), minutes: Math.min(600, Math.max(5, Math.round(body.minutes ?? 30))),
        },
      });
      return apiOk({ task });
    }
    if (body.action === "toggle") {
      const t = await db.studyTask.findFirst({ where: { id: String(body.id ?? ""), studentId } });
      if (!t) return apiErr(404, "کار یافت نشد.", "NOT_FOUND");
      const updated = await db.studyTask.update({ where: { id: t.id }, data: { done: !t.done } });
      return apiOk({ task: updated });
    }
    if (body.action === "delete") {
      await db.studyTask.deleteMany({ where: { id: String(body.id ?? ""), studentId } });
      return apiOk({ ok: true });
    }
    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
