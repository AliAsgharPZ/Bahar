import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | جستجوی سراسری نقش‌محور — بازنویسی راند ۱۸
   FIX: سوپرادمین/ادمین بدون مدرسه هم نتیجه‌های متنوع می‌گیرند
   (کاربر + مدرسه + رویداد + اعلان + بلاگ)، و داخل پنل مدرسه
   مثل مدیرِ همان مدرسه جستجو می‌کنند (acting school).
   FIX: فرار از وایلدکارد LIKE (% و _) + حذف کاراکترهای خطرناک.
   ============================================================ */

type Result = { type: string; title: string; subtitle: string | null; href: string };

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
    if (q.length < 2) return apiOk({ results: [] });
    // نویسه‌های خطرناک LIKE را کامل حذف کن (٪ _ " \ و نمی‌)
    const term = q.replaceAll(/[%_"\\]/g, "").trim();
    if (term.length < 2) return apiOk({ results: [] });

    // دامنه مدرسه: مدرسه خود کاربر یا پنل مدرسه‌ای که سوپرادمین/ادمین واردش شده
    const scope = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
    const isService = me.role === "SUPER_ADMIN" || me.role === "ADMIN";
    // کاربر غیرسرویسیِ بدون مدرسه چیزی برای جستجو ندارد
    if (!isService && !scope) return apiOk({ results: [] });

    const isStaff = me.role === "MANAGER" || me.role === "DEPUTY" || me.role === "CUSTODIAN" || (isService && scope);
    const canSeeStudents = isStaff || me.role === "TEACHER";
    const results: Result[] = [];

    const [students, classes, subjects, users, schools, events, announcements, posts] = await Promise.all([
      // دانش‌آموزان — کارکنان/معلم/سرویس داخل پنل؛ سوپرادمینِ خارج از پنل: کل سامانه
      canSeeStudents
        ? db.student.findMany({
            where: {
              ...(scope ? { schoolId: scope } : {}),
              OR: [
                { user: { firstName: { contains: term } } },
                { user: { lastName: { contains: term } } },
                { studentNumber: { contains: term } },
                { user: { nationalId: { contains: term } } },
              ],
            },
            include: { user: true, class: true },
            take: 6,
          })
        : Promise.resolve([]),
      // کلاس‌ها
      canSeeStudents
        ? db.class.findMany({
            where: {
              ...(scope ? { schoolId: scope } : {}),
              OR: [{ name: { contains: term } }, { grade: { contains: term } }],
            },
            include: scope ? undefined : { school: { select: { name: true } } },
            take: 4,
          })
        : Promise.resolve([]),
      // درس‌ها
      isStaff
        ? db.subject.findMany({
            where: {
              ...(scope ? { schoolId: scope } : {}),
              name: { contains: term },
            },
            include: scope ? undefined : { school: { select: { name: true } } },
            take: 4,
          })
        : Promise.resolve([]),
      // کاربران (مدیر/معاون + سرویس؛ سوپرادمین بدون پنل: کل سامانه)
      me.role === "MANAGER" || me.role === "DEPUTY" || isService
        ? db.user.findMany({
            where: {
              // سوپرادمین خارج از پنل همه را می‌بیند؛ بقیه فقط مدرسه خودشان
              schoolId: scope ?? undefined,
              OR: [
                { firstName: { contains: term } },
                { lastName: { contains: term } },
                { nationalId: { contains: term } },
              ],
            },
            select: { id: true, firstName: true, lastName: true, nationalId: true, role: true, schoolId: true, school: { select: { name: true } } },
            take: 8,
          })
        : Promise.resolve([]),
      // مدارس — فقط نقش سرویس
      isService
        ? db.school.findMany({
            where: { OR: [{ name: { contains: term } }, { code: { contains: term } }, { province: { contains: term } }] },
            select: { id: true, name: true, code: true, province: true },
            take: 4,
          })
        : Promise.resolve([]),
      // رویدادها — مدرسه خود کاربر؛ سرویس بدون پنل: همه
      db.schoolEvent.findMany({
        where: {
          ...(scope ? { schoolId: scope } : isService ? {} : { schoolId: "__none__" }),
          title: { contains: term },
        },
        orderBy: { startAt: "desc" },
        include: scope ? undefined : { school: { select: { name: true } } },
        take: 4,
      }),
      // اعلان‌ها — اعلان‌های مدرسه + اعلان سراسری (schoolId=null)
      scope
        ? db.announcement.findMany({
            where: { OR: [{ schoolId: scope }, { schoolId: null }], title: { contains: term } },
            orderBy: { createdAt: "desc" },
            take: 4,
          })
        : isService
          ? db.announcement.findMany({
              where: { title: { contains: term } },
              orderBy: { createdAt: "desc" },
              take: 4,
            })
          : Promise.resolve([]),
      // بلاگ عمومی
      db.blogPost.findMany({
        where: { status: "PUBLISHED", OR: [{ title: { contains: term } }, { excerpt: { contains: term } }] },
        take: 3,
      }),
    ]);

    for (const s of students) {
      results.push({
        type: "دانش‌آموز",
        title: `${s.user.firstName} ${s.user.lastName}`,
        subtitle: [s.class?.name, s.studentNumber].filter(Boolean).join(" · ") || null,
        href: `/app/students/${s.id}`,
      });
    }
    for (const c of classes) {
      results.push({
        type: "کلاس",
        title: c.name,
        subtitle: [c.grade, !scope ? (c as unknown as { school?: { name: string } }).school?.name : null].filter(Boolean).join(" · ") || null,
        href: "/app/classes",
      });
    }
    for (const s of subjects) {
      results.push({
        type: "درس",
        title: s.name,
        subtitle: [s.grade, !scope ? (s as unknown as { school?: { name: string } }).school?.name : null].filter(Boolean).join(" · ") || null,
        href: "/app/subjects",
      });
    }
    for (const u of users) {
      results.push({
        type: "کاربر",
        title: `${u.firstName} ${u.lastName}`,
        subtitle: [u.nationalId, !scope ? u.school?.name : null].filter(Boolean).join(" · ") || null,
        href: "/app/users",
      });
    }
    for (const s of schools) {
      results.push({
        type: "مدرسه",
        title: s.name,
        subtitle: [s.province, s.code].filter(Boolean).join(" · ") || null,
        href: "/app/schools",
      });
    }
    for (const e of events) {
      results.push({
        type: "رویداد",
        title: e.title,
        subtitle: !scope ? (e as unknown as { school?: { name: string } }).school?.name ?? null : null,
        href: "/app/events",
      });
    }
    for (const a of announcements) {
      results.push({ type: "اعلان", title: a.title, subtitle: null, href: "/app/announcements" });
    }
    for (const p of posts) {
      results.push({ type: "بلاگ", title: p.title, subtitle: null, href: `/blog/${p.slug}` });
    }
    return apiOk({ results: results.slice(0, 24) });
  } catch (e) {
    return handleApiError(e);
  }
}
