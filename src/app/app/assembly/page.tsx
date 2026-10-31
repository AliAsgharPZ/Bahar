"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sunrise, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";

const faToEn = (v: string) => v.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
import { useLang } from "@/lib/i18n";

type Row = { id: string; segment: string; title: string | null; presenterName: string | null; className: string | null; note: string | null };
type Data = { date: string; items: Row[]; isStaff: boolean };

const SEGMENTS = ["قرائت قرآن", "دعای صبحگاهی", "سرود ملی", "سخنرانی دانش‌آموز", "معرفی کتاب", "نرمش صبحگاهی", "اخبار مدرسه", "غیره"];

export default function AssemblyPage() {
  const { t } = useLang();
  const [date, setDate] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/assembly${date ? `?date=${encodeURIComponent(date)}` : ""}`, [date]);
  const [segment, setSegment] = useState(SEGMENTS[0]);
  const [title, setTitle] = useState("");
  const [presenter, setPresenter] = useState("");
  const [className, setClassName] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    setBusy(true);
    try {
      await apiPost("/api/assembly", { date: date || data.date, segment, title: title || undefined, presenterName: presenter || undefined, className: className || undefined });
      setTitle(""); setPresenter(""); setClassName("");
      toast.success(t("assembly.addedToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/assembly?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("assembly.title")} desc={t("assembly.desc")} />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm" htmlFor="asm-date">{t("assembly.date")}</label>
        <input id="asm-date" className="b-input" dir="ltr" value={date} onChange={(e) => setDate(faToEn(e.target.value))} placeholder="1404-08-10" />
        <span className="text-sm text-muted-foreground">{t("assembly.showing")} {faNumber(data.date)}</span>
      </div>
      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Sunrise className="w-5 h-5" /> {t("assembly.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={segment} onChange={(e) => setSegment(e.target.value)} aria-label={t("assembly.f.segment")}>
              {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("assembly.f.title")} />
            <input className="b-input w-full" value={presenter} onChange={(e) => setPresenter(e.target.value)} placeholder={t("assembly.f.presenter")} />
            <input className="b-input w-full" value={className} onChange={(e) => setClassName(e.target.value)} placeholder={t("assembly.f.class")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sunrise className="w-4 h-4" />} {t("assembly.add")}
          </button>
        </section>
      )}
      {data.items.length === 0 ? (
        <EmptyState title={t("assembly.empty")} />
      ) : (
        <ol className="space-y-3">
          {data.items.map((r, i) => (
            <li key={r.id} className="b-card p-4 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold shrink-0">{faNumber(i + 1)}</span>
              <div className="flex-1">
                <p className="font-bold">{r.segment}{r.title ? ` — ${r.title}` : ""}</p>
                <p className="text-sm text-muted-foreground">{[r.presenterName, r.className, r.note].filter(Boolean).join(" · ")}</p>
              </div>
              {data.isStaff && <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("assembly.delete")}><Trash2 className="w-4 h-4" /></button>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
