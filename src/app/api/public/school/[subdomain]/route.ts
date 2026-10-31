import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, apiErr, handleApiError, readJson, ApiError } from "@/lib/api";
import { defaultSiteConfig, parseSiteConfig, templateOf, resolvePalette } from "@/lib/school-site";
import { enDigits } from "@/lib/persian";
import { avatarApiFields } from "@/lib/avatar";

type Ctx = { params: Promise<{ subdomain: string }> };

/** GET /api/public/school/[subdomain] — داده عمومی سایت مدرسه (بدون احراز هویت) */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    const { subdomain } = await ctx.params;
    const site = await db.schoolSite.findUnique({
      where: { subdomain },
      include: { school: true },
    });
    if (!site || !site.published) {
      throw new ApiError(404, "NOT_FOUND", "سایت مدرسه یافت نشد یا منتشر نیست.");
    }
    if (!site.school.isActive) {
      throw new ApiError(410, "INACTIVE", "این مدرسه غیرفعال شده است.");
    }

    const school = site.school;
    const [studentCount, classRows, teacherRows, news, events] = await Promise.all([
      db.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
      db.class.findMany({ where: { schoolId: school.id, isActive: true }, select: { name: true, grade: true, field: true, capacity: true }, orderBy: { name: "asc" }, take: 24 }),
      db.user.findMany({
        where: { schoolId: school.id, role: "TEACHER", isActive: true },
        select: { id: true, firstName: true, lastName: true, education: true, fieldOfStudy: true, photoUrl: true, profileImageType: true, avatarConfig: true },
        orderBy: { lastName: "asc" }, take: 24,
      }).then((rows) => rows.map((t) => ({ ...t, ...avatarApiFields(t) }))),
      db.announcement.findMany({
        // Public site: only announcements addressed to everyone — never
        // role-targeted or class-targeted posts (those stay behind login).
        where: { schoolId: school.id, pinned: true, classId: null, audienceRoles: "[]" },
        orderBy: { createdAt: "desc" }, take: 1,
      }).then(async (pinned) => {
        const rest = await db.announcement.findMany({
          where: { schoolId: school.id, classId: null, audienceRoles: "[]" },
          orderBy: { createdAt: "desc" }, take: 6,
        });
        const seen = new Set(pinned.map((p) => p.id));
        return [...pinned, ...rest.filter((r) => !seen.has(r.id))].slice(0, 6);
      }),
      db.schoolEvent.findMany({
        where: { schoolId: school.id, startAt: { gte: new Date() } },
        orderBy: { startAt: "asc" }, take: 6,
      }),
    ]);

    // شمارش واقعی معلم‌ها از واگذاری‌ها + کاربران
    const teacherCount = teacherRows.length || (await db.teachingAssignment.count({ where: { schoolId: school.id } }));

    // شمارندهٔ بازدید اینجا تغییر نمی‌کند — ثبت بازدید فقط از POST /api/public/school/[subdomain]/view
    const config = { ...defaultSiteConfig(school), ...parseSiteConfig(site.config) };
    const template = templateOf(site.templateId);

    return apiOk({
      site: {
        subdomain: site.subdomain,
        templateId: site.templateId,
        views: site.views,
        config,
        palette: resolvePalette(template, config),
      },
      school: {
        name: school.name,
        type: school.type,
        motto: school.motto,
        about: school.about,
        logoUrl: school.logoUrl,
        province: school.province,
        county: school.county ?? school.city,
        address: school.address,
        phone: school.phone,
        establishedYear: school.establishedYear,
      },
      stats: { students: studentCount, classes: classRows.length, teachers: teacherCount },
      classes: classRows,
      staff: teacherRows,
      news: news.map((n) => ({ title: n.title, body: n.body, pinned: n.pinned, createdAt: n.createdAt })),
      events: events.map((e) => ({ title: e.title, description: e.description, startAt: e.startAt, kind: e.kind })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/public/school/[subdomain] — ثبت لید پیش‌ثبت‌نام از سایت مدرسه */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const { subdomain } = await ctx.params;
    const site = await db.schoolSite.findUnique({
      where: { subdomain },
      include: { school: { select: { id: true, name: true, isActive: true } } },
    });
    if (!site || !site.published || !site.school.isActive) {
      throw new ApiError(404, "NOT_FOUND", "سایت مدرسه یافت نشد.");
    }
    const body = await readJson<Record<string, string>>(req);
    const name = String(body.name ?? "").trim();
    const phone = enDigits(String(body.phone ?? "")).trim();
    if (name.length < 3) throw new ApiError(400, "BAD_NAME", "نام دانش‌آموز را کامل وارد کنید.");
    if (!/^09\d{9}$/.test(phone)) throw new ApiError(400, "BAD_PHONE", "شماره موبایل معتبر (۰۹…) وارد کنید.");

    // ضد هرزنامه: حداکثر ۳ لید با این شماره در روز
    const today = new Date(Date.now() - 86400000);
    const recent = await db.schoolLead.count({ where: { phone, createdAt: { gte: today } } });
    if (recent >= 3) throw new ApiError(429, "TOO_MANY", "درخواست شما ثبت شد؛ لطفاً برای پیگیری تماس بگیرید.");

    const lead = await db.schoolLead.create({
      data: {
        schoolId: site.school.id,
        name,
        parentName: body.parentName ? String(body.parentName).trim() : null,
        phone,
        grade: body.grade ? String(body.grade) : null,
        message: body.message ? String(body.message).slice(0, 500) : null,
      },
    });
    return apiOk({ ok: true, id: lead.id });
  } catch (e) {
    return handleApiError(e);
  }
}
