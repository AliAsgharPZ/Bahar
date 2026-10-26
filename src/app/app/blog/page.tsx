"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Newspaper, Plus, Loader2, Trash2, Eye, Upload, MessageSquare, Check, X, Send } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete, apiPut } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatusBadge } from "@/components/shared/bits";
import { useConfirm } from "@/components/shared/pickers";
import { formatDateTimeFa, relativeTimeFa, faNumber, enDigits } from "@/lib/persian";

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverUrl: string | null;
  tags: string[];
  status: string;
  viewCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { firstName: string; lastName: string } | null;
  comments: Array<{ id: string; name: string; body: string; approved: boolean; createdAt: string }>;
};

export default function BlogAdminPage() {
  const { data, loading, error, refetch } = useApi<{ posts: Post[] }>("/api/blog/admin");
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Post | null>(null);
  const [form, setForm] = useState({ title: "", excerpt: "", body: "", coverUrl: "", tags: "" });
  const [saving, setSaving] = useState(false);
  const [editSlug, setEditSlug] = useState("");
  const [coverUploading, setCoverUploading] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadEditCover(file: File) {
    setCoverUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.url) throw new Error(json?.error?.message ?? "خطا در بارگذاری");
      setEditing((p) => (p ? { ...p, coverUrl: json.url as string } : p));
      toast.success("تصویر کاور بارگذاری شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setCoverUploading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/blog", {
        ...form,
        tags: form.tags.split(/[،,]/).map((t) => t.trim()).filter(Boolean),
        publish: true,
      });
      toast.success("پست منتشر شد.");
      setShowCreate(false);
      setForm({ title: "", excerpt: "", body: "", coverUrl: "", tags: "" });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      // PUT: ویرایش کامل شامل نامک (slug) — PATCH فقط انتشار/نظرات است
      await apiPut("/api/blog/admin", {
        id: editing.id,
        title: editing.title,
        slug: editSlug,
        excerpt: editing.excerpt,
        body: editing.body,
        coverUrl: editing.coverUrl,
        tags: editing.tags,
      });
      toast.success("پست به‌روزرسانی شد.");
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(p: Post) {
    try {
      await apiPatch("/api/blog/admin", { id: p.id, publish: p.status !== "PUBLISHED" });
      toast.success(p.status === "PUBLISHED" ? "از انتشار خارج شد." : "منتشر شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function remove(p: Post) {
    if (!(await confirm({ title: "حذف پست", description: `پست «${p.title}» حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/blog/admin?id=${p.id}`);
      toast.success("حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function moderate(c: { id: string }, action: "approve" | "reject" | "delete") {
    try {
      await apiPatch("/api/blog/admin", { commentId: c.id, commentAction: action });
      toast.success("انجام شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function uploadCover(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا در آپلود");
      setForm((f) => ({ ...f, coverUrl: json.url }));
      toast.success("تصویر شاخص بارگذاری شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const pendingComments = (data?.posts ?? []).reduce((s, p) => s + p.comments.filter((c) => !c.approved).length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="بلاگ سرویس"
        desc="نوشتن و مدیریت پست‌های عمومی بهار + تایید نظرات خوانندگان."
        action={
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> پست جدید
          </button>
        }
      />

      {pendingComments > 0 && (
        <div className="b-promo b-promo-spring">
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span className="truncate">{faNumber(pendingComments)} نظر در انتظار تایید — در فهرست پایین پست مربوطه.</span>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.posts.length === 0 && (
        <EmptyState icon={Newspaper} title="پستی نیست" desc="اولین پست بلاگ بهار را بنویسید — اخبار، راهنما و معرفی قابلیت‌ها." />
      )}

      <div className="flex flex-col gap-3">
        {(data?.posts ?? []).map((p) => (
          <div key={p.id} className="b-card p-5">
            <div className="flex flex-wrap items-center gap-3 mb-3">
              {p.coverUrl && <img src={p.coverUrl} alt={p.title} className="w-16 h-16 rounded-xl object-cover border border-hairline" />}
              <div className="min-w-0 flex-1">
                <b className="text-[14.5px] block truncate">{p.title}</b>
                <span className="text-[11px] text-steel">
                  <span dir="ltr" className="font-mono">/blog/{p.slug}</span> · {p.author ? `${p.author.firstName} ${p.author.lastName}` : "—"} · {faNumber(p.viewCount)} بازدید
                </span>
              </div>
              <StatusBadge ok={p.status === "PUBLISHED"} okLabel="منتشرشده" badLabel="پیش‌نویس" />
              <span className="text-[10.5px] text-stone">{p.status === "PUBLISHED" && p.publishedAt ? formatDateTimeFa(p.publishedAt) : relativeTimeFa(p.updatedAt)}</span>
            </div>

            {p.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {p.tags.map((t, i) => (
                  <span key={i} className="b-badge b-badge-soft !text-[10px]">{t}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-hairline-soft">
              <button className="b-btn b-btn-soft b-btn-sm" onClick={() => { setEditing({ ...p }); setEditSlug(p.slug); }}>
                ویرایش
              </button>
              <button className="b-btn b-btn-soft b-btn-sm" onClick={() => togglePublish(p)}>
                {p.status === "PUBLISHED" ? "لغو انتشار" : "انتشار"}
              </button>
              {p.status === "PUBLISHED" && (
                <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer" className="b-btn b-btn-ghost b-btn-sm !text-steel">
                  <Eye className="w-3.5 h-3.5" /> مشاهده
                </a>
              )}
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive ms-auto" onClick={() => remove(p)}>
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </div>

            {p.comments.length > 0 && (
              <div className="mt-4 b-card-sm !rounded-xl overflow-hidden">
                <b className="text-[12px] block p-3 border-b border-hairline-soft">نظرات ({faNumber(p.comments.length)})</b>
                {p.comments.map((c) => (
                  <div key={c.id} className={`p-3 border-b border-hairline-soft/50 last:border-0 ${!c.approved ? "bg-warning/5" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <b className="text-[12px]">{c.name}</b>
                      <span className="text-[10px] text-stone">{relativeTimeFa(c.createdAt)}</span>
                      {!c.approved && <span className="b-badge b-badge-warning !text-[9px]">در انتظار</span>}
                      {c.approved && <span className="b-badge b-badge-spring !text-[9px]">تاییدشده</span>}
                      <span className="ms-auto flex items-center gap-1">
                        {!c.approved && (
                          <>
                            <button className="w-7 h-7 rounded-full flex items-center justify-center text-spring hover:bg-spring-tint" onClick={() => moderate(c, "approve")} title="تایید">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button className="w-7 h-7 rounded-full flex items-center justify-center text-steel hover:bg-cloud" onClick={() => moderate(c, "reject")} title="رد">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button className="w-7 h-7 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive" onClick={() => moderate(c, "delete")} title="حذف">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                    <p className="text-[12px] text-steel leading-relaxed">{c.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ───── ساخت پست ───── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-6">پست جدید</h2>
            <form onSubmit={create} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">عنوان *</span>
                <input className="b-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">خلاصه</span>
                <textarea rows={2} className="b-input !rounded-2xl resize-none" value={form.excerpt} onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))} placeholder="یک پاراگراف معرفی…" />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">متن پست * (مارک‌داون سبک: ## تیتر، **پررنگ**، - لیست)</span>
                <textarea rows={10} className="b-input !rounded-2xl resize-y" value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} required />
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">برچسب‌ها (با ویرگول)</span>
                  <input className="b-input" value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} placeholder="اخبار، راهنما" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">تصویر شاخص</span>
                  <div className="flex items-center gap-2">
                    {form.coverUrl ? (
                      <img src={form.coverUrl} alt="شاخص" className="w-11 h-11 rounded-xl object-cover border border-hairline" />
                    ) : (
                      <span className="w-11 h-11 rounded-xl bg-cloud flex items-center justify-center text-stone">
                        <Upload className="w-4 h-4" />
                      </span>
                    )}
                    <button type="button" className="b-btn b-btn-soft b-btn-sm" onClick={() => fileRef.current?.click()}>
                      آپلود
                    </button>
                  </div>
                </label>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCover(f);
                }}
              />
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} انتشار پست
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───── ویرایش پست ───── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setEditing(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-6">ویرایش پست</h2>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">عنوان</span>
                <input className="b-input" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">خلاصه</span>
                <textarea rows={2} className="b-input !rounded-2xl resize-none" value={editing.excerpt ?? ""} onChange={(e) => setEditing({ ...editing, excerpt: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">متن</span>
                <textarea rows={10} className="b-input !rounded-2xl resize-y" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">نامک (آدرس پست)</span>
                <input className="b-input" dir="ltr" value={editSlug} onChange={(e) => setEditSlug(e.target.value)} placeholder="my-post-slug" />
                <span className="text-[10.5px] text-steel" dir="ltr">/blog/{editSlug || editing.slug}</span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold">برچسب‌ها (با ویرگول)</span>
                <input className="b-input" value={editing.tags.join("، ")} onChange={(e) => setEditing({ ...editing, tags: e.target.value.split(/[،,]/).map((t) => t.trim()).filter(Boolean) })} />
              </label>
              <div className="flex flex-col gap-2">
                <span className="text-[12.5px] font-bold">تصویر کاور</span>
                {editing.coverUrl && (
                  <img src={editing.coverUrl} alt="کاور فعلی" className="w-full h-36 object-cover rounded-2xl" />
                )}
                <div className="flex items-center gap-2">
                  <input
                    ref={editFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadEditCover(f); e.target.value = ""; }}
                  />
                  <button type="button" className="b-btn b-btn-soft b-btn-sm" onClick={() => editFileRef.current?.click()} disabled={coverUploading}>
                    {coverUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {editing.coverUrl ? "تعویض تصویر" : "بارگذاری تصویر"}
                  </button>
                  {editing.coverUrl && (
                    <button type="button" className="b-btn b-btn-ghost b-btn-sm" onClick={() => setEditing({ ...editing, coverUrl: null })}>
                      <X className="w-4 h-4" /> حذف تصویر
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setEditing(null)}>بستن</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
