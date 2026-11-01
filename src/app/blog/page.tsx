import Link from "next/link";
import Image from "next/image";
import { Sprout, BookOpen, Search, Clock, Eye, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateFa, faNumber } from "@/lib/persian";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SiteLangSelect } from "@/components/shared/site-lang-select";
import { cookies } from "next/headers";
import { SITE_CATALOG } from "@/lib/langs";
import { siteStringsFor } from "@/lib/langs/shipped";

export const dynamic = "force-dynamic";

/** متادیتا به زبان سایت بازدیدکننده (کوکی bahar_site_lang) */
export async function generateMetadata() {
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const S = siteStringsFor(siteLang).siteStrings;
  return {
    title: S["site.meta.blog.title"] ?? SITE_CATALOG["site.meta.blog.title"],
    description: S["site.meta.blog.desc"] ?? SITE_CATALOG["site.meta.blog.desc"],
  };
}

/** زمان مطالعه بر پایهٔ ۲۰۰ واژه در دقیقه (حداقل ۱ دقیقه) */
function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

type Props = {
  searchParams: Promise<{ q?: string; tag?: string; sort?: string; page?: string }>;
};

/** صفحه عمومی فهرست بلاگ — جستجو، فیلتر تگ، مرتب‌سازی و صفحه‌بندی */
export default async function BlogIndexPage({ searchParams }: Props) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const tag = (sp.tag ?? "").trim();
  const sort = sp.sort === "views" ? "views" : "new";
  const page = Math.max(1, Number(sp.page) || 1);
  const perPage = 9;
  const hasFilter = Boolean(q || tag || sort !== "new");

  const where: Record<string, unknown> = { status: "PUBLISHED" };
  if (q) where.OR = [{ title: { contains: q } }, { excerpt: { contains: q } }];
  if (tag) where.tags = { contains: `"${tag.replace(/"/g, "")}"` };

  const [total, posts, tagRows] = await Promise.all([
    db.blogPost.count({ where }),
    db.blogPost.findMany({
      where,
      select: {
        id: true, title: true, slug: true, excerpt: true, body: true, coverUrl: true,
        tags: true, publishedAt: true, viewCount: true,
        author: { select: { firstName: true, lastName: true } },
        _count: { select: { comments: { where: { approved: true } } } },
      },
      orderBy: sort === "views" ? { viewCount: "desc" } : { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.blogPost.findMany({ where: { status: "PUBLISHED" }, select: { tags: true } }),
  ]);

  const allTags = [...new Set(tagRows.flatMap((r) => {
    try { return JSON.parse(r.tags) as string[]; } catch { return []; }
  }))].sort((a, b) => a.localeCompare(b, "fa"));

  // پست ویژه فقط در صفحهٔ اولِ بدون فیلتر نمایش داده می‌شود
  const showFeatured = page === 1 && !hasFilter;
  const [featured, ...rest] = showFeatured ? posts : [undefined, ...posts];
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const site = siteStringsFor(siteLang);
  const S = site.siteStrings;
  const tx = (k: string, fb: string): string => S[k] ?? SITE_CATALOG[k] ?? fb;

  const hrefFor = (patch: Record<string, string | undefined>): string => {
    const params = new URLSearchParams();
    const next = { q: q || undefined, tag: tag || undefined, sort: sort === "views" ? "views" : undefined, page: page > 1 ? String(page) : undefined, ...patch };
    for (const [k, v] of Object.entries(next)) if (v) params.set(k, v);
    const s = params.toString();
    return s ? `/blog?${s}` : "/blog";
  };

  return (
    <div dir={site.direction} className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-background border-b border-hairline-soft">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="بهار" width={30} height={30} />
            <b className="text-base">بهار</b>
          </Link>
          <span className="text-xs text-steel">{tx("site.blog.label", "بلاگ")}</span>
          <div className="ms-auto flex items-center gap-1.5">
            <SiteLangSelect current={siteLang} />
            <ThemeToggle />
            <Link href="/login" className="b-btn b-btn-spring b-btn-sm">{tx("site.blog.login", "ورود")}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 flex-1 w-full">
        <h1 className="text-3xl md:text-4xl font-extrabold mb-2 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-spring" /> {tx("site.blog.title", "بلاگ بهار")}
        </h1>
        <p className="text-sm text-steel mb-8 leading-relaxed">
          {tx("site.blog.intro", "اخبار سامانه، راهنمای استفاده و مقالات حوزه مدیریت مدرسه و آموزش ایران.")}
        </p>

        <form action="/blog" method="get" className="flex items-center gap-2 mb-4">
          {tag && <input type="hidden" name="tag" value={tag} />}
          {sort === "views" && <input type="hidden" name="sort" value="views" />}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={tx("site.blog.searchPlaceholder", "جستجو در عنوان و خلاصهٔ نوشته‌ها…")}
            aria-label={tx("site.blog.searchPlaceholder", "جستجو در بلاگ")}
            className="b-input flex-1 min-w-52"
          />
          <button type="submit" className="b-btn b-btn-spring b-btn-sm min-h-11" aria-label={tx("site.blog.searchPlaceholder", "جستجو در بلاگ")}>
            <Search className="w-4 h-4" />
          </button>
        </form>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            <Link href={hrefFor({ tag: undefined, page: undefined })} className={`b-pill-tab ${!tag ? "b-pill-tab-active" : ""}`}>
              {tx("site.blog.allTags", "همهٔ موضوعات")}
            </Link>
            {allTags.map((t) => (
              <Link key={t} href={hrefFor({ tag: t, page: undefined })} className={`b-pill-tab ${tag === t ? "b-pill-tab-active" : ""}`}>
                {t}
              </Link>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5 mb-8">
          <Link href={hrefFor({ sort: undefined, page: undefined })} className={`b-pill-tab ${sort === "new" ? "b-pill-tab-active" : ""}`}>
            {tx("site.blog.sortNew", "تازه‌ترین")}
          </Link>
          <Link href={hrefFor({ sort: "views", page: undefined })} className={`b-pill-tab ${sort === "views" ? "b-pill-tab-active" : ""}`}>
            {tx("site.blog.sortViews", "پربازدیدترین")}
          </Link>
          {hasFilter && (
            <Link href="/blog" className="b-pill-tab">
              {tx("site.blog.clearFilters", "پاک‌کردن فیلترها")} ✕
            </Link>
          )}
          <span className="text-xs text-stone ms-auto">
            {total > 0 ? `${faNumber(total)} ${tx("site.blog.postsCount", "نوشته")}` : ""}
          </span>
        </div>

        {posts.length === 0 && (
          <div className="b-card p-10 text-center">
            <span className="w-16 h-16 rounded-full bg-spring-tint text-spring flex items-center justify-center mx-auto mb-4">
              <Sprout className="w-8 h-8" />
            </span>
            <b className="text-base block mb-1">
              {hasFilter ? tx("site.blog.noResultsTitle", "نتیجه‌ای یافت نشد") : tx("site.blog.emptyTitle", "هنوز پستی منتشر نشده")}
            </b>
            <p className="text-xs text-steel">
              {hasFilter ? tx("site.blog.noResultsSub", "عبارت یا موضوع دیگری را امتحان کنید.") : tx("site.blog.emptySub", "به‌زودی مقالات و راهنماها اینجا منتشر می‌شود.")}
            </p>
            {hasFilter && (
              <Link href="/blog" className="b-btn b-btn-soft b-btn-sm min-h-11 mt-4 inline-flex">
                {tx("site.blog.clearFilters", "پاک‌کردن فیلترها")}
              </Link>
            )}
          </div>
        )}

        {featured && (
          <Link href={`/blog/${featured.slug}`} className="b-card p-0 overflow-hidden block mb-8 group">
            <div className="grid md:grid-cols-2">
              {featured.coverUrl ? (
                <img src={featured.coverUrl} alt={featured.title} className="w-full h-56 md:h-full object-cover" />
              ) : (
                <div className="h-40 md:h-full bg-spring-tint flex items-center justify-center">
                  <Image src="/logo.svg" alt="بهار" width={80} height={80} />
                </div>
              )}
              <div className="p-6 md:p-8">
                <span className="b-badge b-badge-spring mb-3 inline-block">{tx("site.blog.featured", "پست ویژه")}</span>
                <h2 className="text-xl md:text-2xl font-bold leading-snug mb-3 group-hover:text-spring transition-colors">
                  {featured.title}
                </h2>
                <p className="text-sm text-steel leading-relaxed mb-4 line-clamp-3">{featured.excerpt}</p>
                <span className="text-xs text-stone">
                  {featured.author ? `${featured.author.firstName} ${featured.author.lastName}` : tx("site.blog.fallbackAuthor", "تحریریه بهار")} · {formatDateFa(featured.publishedAt!)} · <Clock className="w-3.5 h-3.5 inline" /> {faNumber(readingMinutes(featured.body))} {tx("site.blog.minutesSuffix", "دقیقه مطالعه")}
                </span>
              </div>
            </div>
          </Link>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rest.map((p) => p && (
            <Link key={p.id} href={`/blog/${p.slug}`} className="b-card-sm b-card-hover p-0 overflow-hidden block group">
              {p.coverUrl && <img src={p.coverUrl} alt={p.title} className="w-full h-36 object-cover" />}
              <div className="p-5">
                <h3 className="text-base font-bold leading-snug mb-2 group-hover:text-spring transition-colors line-clamp-2">{p.title}</h3>
                <p className="text-xs text-steel leading-relaxed line-clamp-3 mb-3">{p.excerpt}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs text-stone">{formatDateFa(p.publishedAt!)} · <Clock className="w-3.5 h-3.5 inline" /> {faNumber(readingMinutes(p.body))} {tx("site.blog.minutesSuffix", "دقیقه مطالعه")}</span>
                  <span className="text-xs text-stone flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" /> {p.viewCount.toLocaleString("fa-IR")} · <MessageSquare className="w-3.5 h-3.5" /> {p._count.comments.toLocaleString("fa-IR")} {tx("site.blog.commentsSuffix", "نظر")}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {totalPages > 1 && (
          <nav className="flex items-center justify-center gap-2 mt-10" aria-label={tx("site.blog.pagination", "صفحه‌بندی")}>
            {page > 1 && (
              <Link href={hrefFor({ page: String(page - 1) })} className="b-btn b-btn-soft b-btn-sm min-h-11">
                {tx("site.blog.prevPage", "صفحهٔ قبل")}
              </Link>
            )}
            <span className="text-xs text-steel">
              {tx("site.blog.pageOf", "صفحهٔ")} {faNumber(page)} {tx("site.blog.pageOfTotal", "از")} {faNumber(totalPages)}
            </span>
            {page < totalPages && (
              <Link href={hrefFor({ page: String(page + 1) })} className="b-btn b-btn-soft b-btn-sm min-h-11">
                {tx("site.blog.nextPage", "صفحهٔ بعد")}
              </Link>
            )}
          </nav>
        )}
      </main>

      <footer className="mt-8 py-8 border-t border-hairline-soft bg-background">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-xs text-steel">{tx("site.blog.footer", "بهار — سامانه جامع مدیریت مدارس ایران")}</span>
          <div className="flex items-center gap-4 text-xs font-bold">
            <Link href="/" className="hover:text-spring">{tx("site.blog.home", "خانه")}</Link>
            
            <Link href="/login" className="hover:text-spring">{tx("site.blog.login", "ورود")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
