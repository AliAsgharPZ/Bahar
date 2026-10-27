import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | پنل پیامک — ارسال گروهی به اولیا/معلمان/دانش‌آموزان
   یا یک کلاس. در این استقرار دمو، درگاه واقعی وصل نیست:
   پیام‌ها با وضعیت «نمایشی» ثبت و در لاگ نگه داشته می‌شوند
   و هم‌زمان اعلان درون‌برنامه‌ای برای گیرندگان ساخته می‌شود
   تا چرخه کامل قابل تست باشد.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];
const AUDIENCES = ["PARENTS", "TEACHERS", "STUDENTS", "CLASS", "ALL"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const logs = await db.smsLog.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 50 });
    return apiOk({ logs, provider: "MOCK" });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req, STAFF);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const body = await readJson<{ audience?: string; classId?: string; text?: string }>(req);
    const text = (body.text ?? "").trim();
    if (text.length < 3) return apiErr(400, "متن پیامک را بنویسید.", "BAD_INPUT");
    if (text.length > 500) return apiErr(400, "متن پیامک حداکثر ۵۰۰ نویسه است.", "TOO_LONG");
    const audience = AUDIENCES.includes(body.audience ?? "") ? body.audience! : "PARENTS";

    // حل گیرندگان از روی نقش/کلاس
    let userIds: string[] = [];
    if (audience === "TEACHERS") {
      userIds = (await db.user.findMany({ where: { schoolId, role: { in: ["TEACHER", "MANAGER", "DEPUTY", "CUSTODIAN"] }, isActive: true }, select: { id: true } })).map((u) => u.id);
    } else if (audience === "STUDENTS" || audience === "CLASS") {
      const students = await db.student.findMany({
        where: { schoolId, status: "ACTIVE", ...(audience === "CLASS" ? { classId: String(body.classId ?? "") } : {}) },
        select: { userId: true },
      });
      userIds = students.map((s) => s.userId);
    } else {
      // PARENTS و ALL: اولیای دانش‌آموزان فعال (+ خود دانش‌آموزان در حالت ALL)
      const links = await db.studentParent.findMany({
        where: { student: { schoolId, status: "ACTIVE" } },
        select: { parentUserId: true, student: { select: { userId: true } } },
      });
      userIds = [...new Set(links.map((l) => l.parentUserId))];
      if (audience === "ALL") userIds = [...new Set([...userIds, ...links.map((l) => l.student.userId)])];
    }
    if (!userIds.length) return apiErr(400, "برای این مخاطب، گیرنده‌ای با حساب فعال پیدا نشد.", "NO_RECIPIENTS");

    const phones = await db.user.findMany({ where: { id: { in: userIds } }, select: { phone: true } });
    const withPhone = phones.filter((u) => (u.phone ?? "").trim().length >= 10).length;

    const log = await db.smsLog.create({
      data: {
        schoolId, audience, classId: audience === "CLASS" ? String(body.classId ?? "") : null,
        text: text.slice(0, 500), recipientCount: withPhone, createdById: me.id,
      },
    });
    // اعلان درون‌برنامه‌ای موازی (چون درگاه نمایشی است، پیام از این کانال واقعاً می‌رسد)
    await db.notification.createMany({
      data: userIds.map((uid) => ({
        userId: uid, kind: "MESSAGE", category: "IMPORTANT",
        title: "پیام مدرسه", body: text.slice(0, 300), link: "/app/messages",
      })),
    });
    await audit({ user: me, action: "ارسال پیامک گروهی (نمایشی)", entityType: "SmsLog", entityId: log.id, schoolId });
    return apiOk({ log, recipients: withPhone, notified: userIds.length });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.smsLog.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.smsLog.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
