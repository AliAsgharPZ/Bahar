import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Markdown } from "@/components/shared/markdown";
import { formatDateFa } from "@/lib/persian";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SiteLangSelect } from "@/components/shared/site-lang-select";
import { cookies } from "next/headers";
import { SITE_CATALOG } from "@/lib/langs";
import { siteStringsFor } from "@/lib/langs/shipped";
import { ShareBar } from "./share-bar";
import { CommentForm, CommentsList } from "./comments";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({ where: { slug }, select: { title: true, excerpt: true } });
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const S = siteStringsFor(siteLang).siteStrings;
  const notFound = S["site.blog.postNotFound"] ?? SITE_CATALOG["site.blog.postNotFound"] ?? "پست یافت نشد";
  if (!post) return { title: `${notFound} | بهار` };
  return { title: `${post.title} | ${S["site.blog.title"] ?? SITE_CATALOG["site.blog.title"] ?? "بلاگ بهار"}`, description: post.excerpt ?? undefined };
}

/** صفحه عمومی پست بلاگ */
export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await db.blogPost.findUnique({
    where: { slug },
    include: { author: { select: { firstName: true, lastName: true } } },
  });
  if (!post || post.status !== "PUBLISHED") notFound();

  await db.blogPost.update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } });
  const comments = await db.blogComment.findMany({
    where: { postId: post.id, approved: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const tags = JSON.parse(post.tags) as string[];
  const url = `/blog/${post.slug}`;
  let siteLang = "fa";
  try { siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa"; } catch { /* fa */ }
  const site = siteStringsFor(siteLang);
  const S = site.siteStrings;
  const tx = (k: string, fb: string): string => S[k] ?? SITE_CATALOG[k] ?? fb;

  return (
    <div dir={site.direction} className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-30 bg-background border-b border-hairline-soft">
        <div className="max-w-3xl mx-auto px-4 h-16 flex items-center gap-3">
          <Link href="/blog" className="flex items-center gap-2">
            <Image src="/logo.svg" alt="بهار" width={28} height={28} />
            <b className="text-[16px]">{tx("site.blog.label", "بلاگ")}</b>
          </Link>
          <div className="ms-auto flex items-center gap-1.5"><SiteLangSelect current={siteLang} /><ThemeToggle /><Link href="/" className="b-btn b-btn-soft b-btn-sm">{tx("site.blog.home", "خانه")}</Link></div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 flex-1 w-full">
        <article className="b-card !rounded-3xl p-0 overflow-hidden mb-8">
          {post.coverUrl && (
            <img src={post.coverUrl} alt={post.title} className="w-full h-56 md:h-72 object-cover" />
          )}
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {tags.map((t, i) => (
                <span key={i} className="b-badge b-badge-soft">{t}</span>
              ))}
            </div>
            <h1 className="text-[24px] md:text-[32px] font-extrabold leading-snug mb-4">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-[12px] text-steel mb-6 pb-6 border-b border-hairline-soft">
              <span>{post.author ? `${post.author.firstName} ${post.author.lastName}` : tx("site.blog.fallbackAuthor", "تحریریه بهار")}</span>
              <span>· {formatDateFa(post.publishedAt!)}</span>
              <span>· {(post.viewCount + 1).toLocaleString("fa-IR")} {tx("site.blog.viewsSuffix", "بازدید")}</span>
            </div>
            <div className="markdown-body text-foreground">
              <Markdown source={post.body} />
            </div>
          </div>
        </article>

        <ShareBar url={url} title={post.title} texts={{ heading: tx("site.blog.shareHeading", "اشتراک‌گذاری این نوشته:"), copied: tx("site.blog.copied", "کپی شد"), copyLink: tx("site.blog.copyLink", "کپی لینک"), share: tx("site.blog.share", "اشتراک‌گذاری"), linkCopied: tx("site.blog.linkCopied", "لینک کپی شد."), linkCopyFailed: tx("site.blog.linkCopyFailed", "کپی نشد — لینک را دستی کپی کنید.") }} />

        <section className="b-card !rounded-3xl p-6 md:p-8 mb-8">
          <h2 className="font-bold text-[16px] mb-5">{tx("site.blog.commentsHeading", "نظرات")} ({comments.length.toLocaleString("fa-IR")})</h2>
          <CommentsList comments={comments.map((c) => ({ name: c.name, body: c.body, createdAt: c.createdAt.toISOString() }))} firstComment={tx("site.blog.firstComment", "اولین نظر را شما بنویسید.")} />
          <div className="mt-8 pt-6 border-t border-hairline">
            <h3 className="font-bold text-[14px] mb-4">{tx("site.blog.newComment", "ثبت نظر جدید")}</h3>
            <CommentForm slug={post.slug} texts={{ done: tx("site.blog.commentDone", "نظر شما ثبت شد"), toastDone: tx("site.blog.commentToastDone", "نظر شما ثبت شد و پس از تایید نمایش داده می‌شود."), error: tx("site.blog.commentError", "خطا"), namePlaceholder: tx("site.blog.namePlaceholder", "نام شما *"), bodyPlaceholder: tx("site.blog.bodyPlaceholder", "نظر شما (پس از تایید نمایش داده می‌شود)…"), submit: tx("site.blog.submitComment", "ثبت نظر") }} />
          </div>
        </section>
      </main>

      <footer className="mt-8 py-8 border-t border-hairline-soft bg-background">
        <div className="max-w-3xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
          <span className="text-[12px] text-steel">{tx("site.blog.footer2", "بهار — سامانه جامع مدیریت مدارس")}</span>
          <div className="flex items-center gap-4 text-[12px] font-bold">
            <Link href="/blog" className="hover:text-spring">{tx("site.blog.label", "بلاگ")}</Link>
            
          </div>
        </div>
      </footer>
    </div>
  );
}
