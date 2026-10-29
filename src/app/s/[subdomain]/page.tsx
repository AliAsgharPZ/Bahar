import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Sprout as SproutIcon } from "lucide-react";
import { db } from "@/lib/db";
import { defaultSiteConfig, parseSiteConfig, templateOf } from "@/lib/school-site";
import { SchoolSiteRenderer } from "@/components/school-site/templates";
import { avatarApiFields } from "@/lib/avatar";
import { verifyToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ subdomain: string }>;
  searchParams: Promise<{ preview?: string }>;
};

/**
 * پیش‌نمایش (?preview=1) فقط برای مدیر/معاون همان مدرسه یا نقش سرویس —
 * قبلاً بدون احراز هویت بود و هر کسی با حدس ساب‌دامنه می‌توانست پیش‌نویس را ببیند.
 */
async function canPreview(schoolId: string): Promise<boolean> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const payload = verifyToken(token);
  if (!payload || typeof payload.sub !== "string") return false;
  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: { role: true, schoolId: true, isActive: true },
  });
  if (!user?.isActive) return false;
  if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") return true;
  return user.schoolId === schoolId && ["MANAGER", "DEPUTY"].includes(user.role);
}

export async function generateMetadata({ params }: Props) {
  const { subdomain } = await params;
  const site = await db.schoolSite.findUnique({
    where: { subdomain },
    include: { school: { select: { name: true, motto: true } } },
  });
  if (!site) return { title: "مدرسه یافت نشد | بهار" };
  return {
    title: `${site.school.name} | بهار`,
    description: site.school.motto ?? `سایت رسمی ${site.school.name}`,
  };
}

/** صفحه عمومی سایت مدرسه — /s/[subdomain] */
export default async function SchoolSitePage({ params, searchParams }: Props) {
  const { subdomain } = await params;
  const sp = await searchParams;
  const previewRequested = sp.preview === "1";

  const site = await db.schoolSite.findUnique({
    where: { subdomain },
    include: { school: true },
  });
  if (!site) notFound();

  // پیش‌نمایش فقط با احراز هویت (مدیر/معاون همان مدرسه یا نقش سرویس)
  const preview = previewRequested && (await canPreview(site.schoolId));
  const published = site.published || preview;
  if (!published) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F8F6] p-6" dir="rtl">
        <div className="b-card p-8 text-center max-w-md">
          <span className="w-16 h-16 rounded-full bg-[#E8F0EC] text-spring flex items-center justify-center mx-auto mb-3">
            <SproutIcon className="w-8 h-8" />
          </span>
          <h1 className="text-xl font-bold mb-2">سایت این مدرسه هنوز منتشر نشده</h1>
          <p className="text-[13px] text-[#5B6B66] leading-relaxed">
            مدیر مدرسه می‌تواند از پنل بهار، تمپلیت سایت را انتخاب و شخصی‌سازی کند و سپس منتشر شود.
          </p>
          <a href="/" className="b-btn b-btn-spring b-btn-sm mt-5 inline-flex">بازگشت به بهار</a>
        </div>
      </div>
    );
  }

  if (!site.school.isActive) notFound();

  const school = site.school;
  const [studentCount, classRows, teacherRows, news, events] = await Promise.all([
    db.student.count({ where: { schoolId: school.id, status: "ACTIVE" } }),
    db.class.findMany({ where: { schoolId: school.id, isActive: true }, select: { name: true, grade: true, field: true, capacity: true }, orderBy: { name: "asc" }, take: 24 }),
    db.user.findMany({
      where: { schoolId: school.id, role: "TEACHER", isActive: true },
      select: { id: true, firstName: true, lastName: true, education: true, fieldOfStudy: true, photoUrl: true, profileImageType: true, avatarConfig: true },
      orderBy: { lastName: "asc" }, take: 24,
    }).then((rows) => rows.map((t) => ({ ...t, ...avatarApiFields(t) }))),
    db.announcement.findMany({ where: { schoolId: school.id }, orderBy: [{ pinned: "desc" }, { createdAt: "desc" }], take: 6 }),
    db.schoolEvent.findMany({ where: { schoolId: school.id, startAt: { gte: new Date() } }, orderBy: { startAt: "asc" }, take: 6 }),
  ]);

  if (!preview) {
    await db.schoolSite.update({ where: { id: site.id }, data: { views: { increment: 1 } } });
  }

  const config = { ...defaultSiteConfig(school), ...parseSiteConfig(site.config) };
  const template = templateOf(site.templateId);
  const palette = template.palettes[Math.min(config.palette ?? 0, template.palettes.length - 1)];

  const data = {
    school: {
      name: school.name,
      type: school.type,
      motto: school.motto,
      logoUrl: school.logoUrl,
      province: school.province,
      county: school.county ?? school.city,
      address: school.address,
      phone: school.phone,
      establishedYear: school.establishedYear,
    },
    stats: { students: studentCount, classes: classRows.length, teachers: teacherRows.length },
    classes: classRows,
    staff: teacherRows,
    news: news.map((n) => ({ title: n.title, body: n.body, pinned: n.pinned, createdAt: n.createdAt.toISOString() })),
    events: events.map((e) => ({ title: e.title, description: e.description, startAt: e.startAt.toISOString(), kind: e.kind })),
  };

  return (
    <>
      {preview && (
        <div className="sticky top-0 z-50 bg-[#B2620F] text-white text-center text-[12px] py-2 font-bold" dir="rtl">
          حالت پیش‌نمایش — این صفحه هنوز منتشر نشده است
        </div>
      )}
              <SchoolSiteRenderer
          templateId={site.templateId}
          palette={palette}
          config={config}
          data={data}
          subdomain={subdomain}
        />
    </>
  );
}
