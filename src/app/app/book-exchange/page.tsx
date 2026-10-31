"use client";

import { useState } from "react";
import { toast } from "sonner";
import { BookCopy, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; grade: string | null; price: number | null; status: string; ownerName: string; note: string | null; mine: boolean };
type Data = { items: Row[]; isStaff: boolean; myStudentId: string | null };

export default function BookExchangePage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/book-exchange");
  const [title, setTitle] = useState("");
  const [grade, setGrade] = useState("");
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("books.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/book-exchange", { title, grade: grade || undefined, price: price ? Number(price) : undefined }); setTitle(""); setGrade(""); setPrice(""); toast.success(t("books.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const toggle = async (r: Row) => {
    try { await apiPatch("/api/book-exchange", { id: r.id, status: r.status === "SOLD" ? "AVAILABLE" : "SOLD" }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/book-exchange?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const items = data.items.filter((r) => !q || r.title.includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={t("books.title")} desc={t("books.desc")} />
      {(data.myStudentId || data.isStaff) && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><BookCopy className="w-5 h-5" /> {t("books.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-3">
            <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("books.f.title")} />
            <input className="b-input w-full" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder={t("books.f.grade")} />
            <input className="b-input w-full" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={t("books.f.price")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookCopy className="w-4 h-4" />} {t("books.add")}
          </button>
        </section>
      )}
      <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("books.searchPh")} aria-label={t("books.searchPh")} />
      {items.length === 0 ? (
        <EmptyState title={t("books.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.title}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "AVAILABLE" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                  {r.status === "AVAILABLE" ? t("books.available") : t("books.sold")}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {r.ownerName}{r.grade ? ` · ${r.grade}` : ""}
                {r.price !== null ? ` · ${faNumber(r.price)} تومان` : ` · ${t("books.free")}`}
                {r.note ? ` · ${r.note}` : ""}
              </p>
              {(r.mine || data.isStaff) && (
                <div className="flex gap-2 pt-1">
                  <button className="b-btn b-btn-ghost min-h-11" onClick={() => toggle(r)}>{r.status === "AVAILABLE" ? t("books.markSold") : t("books.markAvailable")}</button>
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("books.delete")}><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
