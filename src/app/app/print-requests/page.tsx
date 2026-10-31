"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Printer, Loader2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; title: string; copies: number; pages: number; color: boolean; status: string; requesterName: string; note: string | null };
type Data = { isOffice: boolean; items: Row[] };

export default function PrintRequestsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/print-requests");
  const [title, setTitle] = useState("");
  const [copies, setCopies] = useState("30");
  const [pages, setPages] = useState("1");
  const [color, setColor] = useState(false);
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!title.trim()) { toast.error(t("print.f.title")); return; }
    setBusy(true);
    try { await apiPost("/api/print-requests", { title, copies: Number(copies) || 1, pages: Number(pages) || 1, color }); setTitle(""); toast.success(t("print.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const decide = async (id: string, status: string) => {
    try { await apiPatch("/api/print-requests", { id, status }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("print.title")} desc={t("print.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Printer className="w-5 h-5" /> {t("print.addTitle")}</h2>
        <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("print.f.title")} />
        <div className="grid gap-3 md:grid-cols-3">
          <input className="b-input w-full" inputMode="numeric" value={copies} onChange={(e) => setCopies(e.target.value)} placeholder={t("print.f.copies")} aria-label={t("print.f.copies")} />
          <input className="b-input w-full" inputMode="numeric" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={t("print.f.pages")} aria-label={t("print.f.pages")} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={color} onChange={(e) => setColor(e.target.checked)} className="w-5 h-5" />
            {t("print.f.color")}
          </label>
        </div>
        <p className="text-sm text-muted-foreground">{t("print.total")}: {faNumber((Number(copies) || 0) * (Number(pages) || 0))} {t("print.sheets")}</p>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />} {t("print.add")}
        </button>
      </section>
      {data.items.length === 0 ? (
        <EmptyState title={t("print.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.title}</p>
                <p className="text-sm text-muted-foreground">
                  {r.requesterName} · {faNumber(r.copies)} {t("print.copies")} × {faNumber(r.pages)} {t("print.sheets")} · {r.color ? t("print.colorful") : t("print.bw")}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "READY" ? "bg-success/15 text-success" : r.status === "REJECTED" ? "bg-destructive/15 text-destructive" : r.status === "PRINTING" ? "bg-info/15 text-info" : "bg-warning/15 text-warning"}`}>
                {t(`print.status.${r.status}`)}
              </span>
              {data.isOffice && r.status === "PENDING" && (<>
                <button className="b-btn b-btn-ghost min-h-11" onClick={() => decide(r.id, "PRINTING")}>{t("print.start")}</button>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => decide(r.id, "REJECTED")}>{t("print.reject")}</button>
              </>)}
              {data.isOffice && r.status === "PRINTING" && (
                <button className="b-btn b-btn-primary min-h-11" onClick={() => decide(r.id, "READY")}>{t("print.ready")}</button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
