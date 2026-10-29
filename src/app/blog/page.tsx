import Link from "next/link";
import Image from "next/image";
import { Sprout, BookOpen } from "lucide-react";
import { db } from "@/lib/db";
import { formatDateFa } from "@/lib/persian";
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

/** صفحه عمومی فهرست بلاگ */
export default async function BlogIndexPage() {
  const posts = await db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    select: {
      id: true, title: true, slug: true, excerpt: true, coverUrl: true,
      tags: true, publishedAt: true, viewCount: true,
      author: { select: { firstName: true, lastName: true } },
      _count: { select: { comments: { where: { approved: true } } } },
    },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  const [featured, ...rest] = posts;
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const site = siteStringsFor(siteLang);
  const S = site.siteStrings;
  const tx = (k: string, fb: string): string => S[k] ?? SITE_CATALOG[k] ?? fb;

  return (
    <div dir={site.direction} className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-background border-b border-hairline-soft">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="بهار" width={30} height={30} />
            <b className="text-[16px]">بهار</b>
          </Link>
          <span className="text-[12px] text-steel">{tx("site.blog.label", "بلاگ")}</span>
          <div className="ms-auto flex items-center gap-1.5">
            <SiteLangSelect current={siteLang} />
            <ThemeToggle />
            <Link href="/login" className="b-btn b-btn-spring b-btn-sm">{tx("site.blog.login", "ورود")}</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 flex-1 w-full">
        <h1 className="text-[28px] md:text-[34px] font-extrabold mb-2 flex items-center gap-3">
          <BookOpen className="w-7 h-7 text-spring" /> {tx("site.blog.title", "بلاگ بهار")}
        </h1>
        <p className="text-[14px] text-steel mb-10 leading-relaxed">
          {tx("site.blog.intro", "اخبار سامانه، راهنمای استفاده و مقالات حوزه مدیریت مدرسه و آموزش ایران.")}
        </p>

        {posts.length === 0 && (
          <div className="b-card p-10 text-center">
            <span className="w-16 h-16 rounded-full bg-spring-tint text-spring flex items-center justify-center mx-auto mb-4">
              <Sprout className="w-8 h-8" />
            </span>
            <b className="text-[16px] block mb-1">{tx("site.blog.emptyTitle", "هنوز پستی منتشر نشده")}</b>
            <p className="text-[12px] text-steel">{tx("site.blog.emptySub", "به‌زودی مقالات و راهنماها اینجا منتشر می‌شود.")}</p>
          </div>
        )}

        {featured && (
          <Link href={`/blog/${featured.slug}`} className="b-card !rounded-3xl p-0 overflow-hidden block mb-8 transition-shadow group">
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
                <h2 className="text-[20px] md:text-[24px] font-bold leading-snug mb-3 group-hover:text-spring transition-colors">
                  {featured.title}
                </h2>
                <p className="text-[14px] text-steel leading-relaxed mb-4 line-clamp-3">{featured.excerpt}</p>
                <span className="text-[12px] text-stone">
                  {featured.author ? `${featured.author.firstName} ${featured.author.lastName}` : tx("site.blog.fallbackAuthor", "تحریریه بهار")} · {formatDateFa(featured.publishedAt!)}
                </span>
              </div>
            </div>
          </Link>
        )}

        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rest.map((p) => (
            <Link key={p.id} href={`/blog/${p.slug}`} className="b-card !rounded-2xl p-0 overflow-hidden block hover:shadow-md transition-all hover:-translate-y-0.5 group">
              {p.coverUrl && <img src={p.coverUrl} alt={p.title} className="w-full h-36 object-cover" />}
              <div className="p-5">
                <h3 className="text-[16px] font-bold leading-snug mb-2 group-hover:text-spring transition-colors line-clamp-2">{p.title}</h3>
                <p className="text-[12px] text-steel leading-relaxed line-clamp-3 mb-3">{p.excerpt}</p>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[12px] text-stone">{formatDateFa(p.publishedAt!)} · {p._count.comments.toLocaleString("fa-IR")} {tx("site.blog.commentsSuffix", "نظر")}</span>
                  <span className="text-[12px] text-stone">{p.viewCount.toLocaleString("fa-IR")} {tx("site.blog.viewsSuffix", "بازدید")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>

      <footer className="mt-8 py-8 border-t border-hairline-soft bg-background">
        <div className="max-w-5xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-[12px] text-steel">{tx("site.blog.footer", "بهار — سامانه جامع مدیریت مدارس ایران")}</span>
          <div className="flex items-center gap-4 text-[12px] font-bold">
            <Link href="/" className="hover:text-spring">{tx("site.blog.home", "خانه")}</Link>
            
            <Link href="/login" className="hover:text-spring">{tx("site.blog.login", "ورود")}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
