import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser, actingSchoolIdFor } from "@/lib/api";
import { defaultSiteConfig, parseSiteConfig, templateOf, SITE_TEMPLATES, type SiteConfig } from "@/lib/school-site";
import { slugify } from "@/lib/persian";

/** GET /api/school-site — پیکربندی سایت مدرسه (مدیر یا ادمین پنل) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const actingCookie = actingSchoolIdFor(req, me) ?? undefined;
    const schoolIdParam = new URL(req.url).searchParams.get("schoolId");
    const schoolId = me.role === "SUPER_ADMIN" || me.role === "ADMIN"
      ? (actingCookie ?? (me.role === "SUPER_ADMIN" ? schoolIdParam ?? undefined : undefined))
      : me.schoolId;
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای انتخاب نشده است.");

    const school = await db.school.findUnique({
      where: { id: schoolId },
      include: { site: true },
    });
    if (!school) throw new ApiError(404, "NOT_FOUND", "مدرسه یافت نشد.");
    if (!school.site) {
      // ساخت خودکار اگر نبود
      let sub = slugify(school.name);
      const taken = await db.schoolSite.findUnique({ where: { subdomain: sub } });
      if (taken) sub = `${sub}-${school.code}`.slice(0, 40);
      const site = await db.schoolSite.create({
        data: { schoolId: school.id, subdomain: sub, templateId: "classic", published: false },
      });
      school.site = site;
    }

    const config = { ...defaultSiteConfig(school), ...parseSiteConfig(school.site.config) };

    return apiOk({
      site: {
        ...school.site,
        config,
        templates: SITE_TEMPLATES,
        school: { id: school.id, name: school.name, motto: school.motto, about: school.about, phone: school.phone, address: school.address, logoUrl: school.logoUrl },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/school-site — ذخیره تمپلیت/پیکربندی/انتشار (مدیر یا ادمین) */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<Record<string, unknown>>(req);
    const actingCookie = actingSchoolIdFor(req, me) ?? undefined;
    // ADMIN فقط در پنل مدرسه (کوکی معتبر) یا با مجوز edit_schools می‌تواند ویرایش کند
    const schoolId = me.role === "SUPER_ADMIN"
      ? (String(body.schoolId ?? "") || actingCookie || undefined)
      : me.role === "MANAGER" ? me.schoolId ?? undefined
      : actingCookie;
    if (!schoolId) throw new ApiError(400, "NO_SCHOOL", "مدرسه‌ای انتخاب نشده است.");

    const school = await db.school.findUnique({ where: { id: schoolId }, include: { site: true } });
    if (!school) throw new ApiError(404, "NOT_FOUND", "مدرسه یافت نشد.");

    const isOwnManager = me.role === "MANAGER" && me.schoolId === schoolId;
    const isSuper = me.role === "SUPER_ADMIN";
    const isAdminEditor = me.role === "ADMIN" && !!actingCookie && actingCookie === schoolId;
    if (!isOwnManager && !isSuper && !isAdminEditor) {
      throw new ApiError(403, "FORBIDDEN", "ویرایش سایت مدرسه فقط توسط مدیر آن مدرسه یا ادمین سامانه ممکن است.");
    }

    if (!school.site) {
      let sub = slugify(school.name);
      const taken = await db.schoolSite.findUnique({ where: { subdomain: sub } });
      if (taken) sub = `${sub}-${school.code}`.slice(0, 40);
      await db.schoolSite.create({ data: { schoolId: school.id, subdomain: sub } });
    }

    const data: Record<string, unknown> = {};
    if (body.templateId !== undefined) {
      const tid = String(body.templateId);
      if (!SITE_TEMPLATES.some((t) => t.id === tid)) throw new ApiError(400, "BAD_TEMPLATE", "تمپلیت نامعتبر است.");
      data.templateId = tid;
    }
    if (body.published !== undefined) {
      data.published = Boolean(body.published);
    }
    if (body.subdomain !== undefined) {
      const sub = slugify(String(body.subdomain));
      if (!sub || sub === "school") throw new ApiError(400, "BAD_SUBDOMAIN", "نام آدرس اختصاصی باید حروف لاتین یا رقم باشد.");
      const dupe = await db.schoolSite.findFirst({ where: { subdomain: sub, NOT: { schoolId } } });
      if (dupe) throw new ApiError(409, "DUPLICATE", "این آدرس اختصاصی قبلاً گرفته شده است.");
      data.subdomain = sub;
    }
    if (body.config !== undefined && body.config && typeof body.config === "object") {
      // فقط فیلدهای مجاز — ساختار قفل است
      const c = body.config as Partial<SiteConfig>;
      const base = { ...defaultSiteConfig(school), ...parseSiteConfig(school.site?.config) };
      const safe: SiteConfig = {
        palette: typeof c.palette === "number" ? Math.max(0, Math.min(2, c.palette)) : base.palette,
        heroTitle: typeof c.heroTitle === "string" ? c.heroTitle.slice(0, 90) : base.heroTitle,
        heroSubtitle: typeof c.heroSubtitle === "string" ? c.heroSubtitle.slice(0, 140) : base.heroSubtitle,
        heroImage: typeof c.heroImage === "string" ? c.heroImage.slice(0, 500) : base.heroImage,
        ctaPrimary: typeof c.ctaPrimary === "string" ? c.ctaPrimary.slice(0, 40) : base.ctaPrimary,
        aboutTitle: typeof c.aboutTitle === "string" ? c.aboutTitle.slice(0, 90) : base.aboutTitle,
        aboutText: typeof c.aboutText === "string" ? c.aboutText.slice(0, 2000) : base.aboutText,
        aboutImage: typeof c.aboutImage === "string" ? c.aboutImage.slice(0, 500) : base.aboutImage,
        principalMessage: typeof c.principalMessage === "string" ? c.principalMessage.slice(0, 2000) : base.principalMessage,
        principalPhoto: typeof c.principalPhoto === "string" ? c.principalPhoto.slice(0, 500) : base.principalPhoto,
        gallery: Array.isArray(c.gallery) ? c.gallery.filter((g) => typeof g === "string").slice(0, 12) : base.gallery,
        faq: Array.isArray(c.faq)
          ? c.faq.filter((f) => f && typeof f.q === "string" && typeof f.a === "string").slice(0, 10)
          : base.faq,
        contactHours: typeof c.contactHours === "string" ? c.contactHours.slice(0, 200) : base.contactHours,
        contactPhone: typeof c.contactPhone === "string" ? c.contactPhone.slice(0, 30) : base.contactPhone,
        contactAddress: typeof c.contactAddress === "string" ? c.contactAddress.slice(0, 300) : base.contactAddress,
        sections: {
          stats: Boolean(c.sections?.stats), about: Boolean(c.sections?.about),
          principal: Boolean(c.sections?.principal), news: Boolean(c.sections?.news),
          events: Boolean(c.sections?.events), classes: Boolean(c.sections?.classes),
          staff: Boolean(c.sections?.staff), gallery: Boolean(c.sections?.gallery),
          faq: Boolean(c.sections?.faq), contact: Boolean(c.sections?.contact),
          admissions: Boolean(c.sections?.admissions),
        },
      };
      data.config = JSON.stringify(safe);
    }

    if (Object.keys(data).length === 0) return apiOk({ ok: true, subdomain: school.site?.subdomain ?? undefined });

    // FIX (راند ۱۸): ردیف به‌روز را برگردان — کلاینت لینک‌ها را از subdomain واقعی (اسلاگ‌شده سمت سرور) می‌سازد
    const updated = await db.schoolSite.update({ where: { schoolId }, data });
    await audit({
      user: me, action: "UPDATE_SCHOOL_SITE", entityType: "SCHOOL_SITE", entityId: schoolId,
      schoolId, meta: { fields: Object.keys(data) },
    });
    return apiOk({ ok: true, subdomain: updated.subdomain, published: updated.published });
  } catch (e) {
    return handleApiError(e);
  }
}
