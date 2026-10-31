"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bike, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; kind: string; color: string | null; serial: string | null; spot: string | null; studentName: string; className: string | null };
type Data = { isStaff: boolean; items: Row[] };

const KINDS = ["دوچرخه", "اسکوتر", "اسکیت‌برد", "دیگر"];

export default function BikeRegistryPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/bike-registry");
  const [kind, setKind] = useState(KINDS[0]);
  const [color, setColor] = useState("");
  const [serial, setSerial] = useState("");
  const [spot, setSpot] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    setBusy(true);
    try { await apiPost("/api/bike-registry", { kind, color: color || undefined, serial: serial || undefined, spot: spot || undefined }); setColor(""); setSerial(""); setSpot(""); toast.success(t("bikes.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/bike-registry?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const items = data.items.filter((r) => !q || r.studentName.includes(q) || (r.serial ?? "").includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={t("bikes.title")} desc={t("bikes.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Bike className="w-5 h-5" /> {t("bikes.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="b-input w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("bikes.f.kind")}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input className="b-input w-full" value={color} onChange={(e) => setColor(e.target.value)} placeholder={t("bikes.f.color")} />
          <input className="b-input w-full" value={serial} onChange={(e) => setSerial(e.target.value)} placeholder={t("bikes.f.serial")} />
          <input className="b-input w-full" value={spot} onChange={(e) => setSpot(e.target.value)} placeholder={t("bikes.f.spot")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bike className="w-4 h-4" />} {t("bikes.add")}
        </button>
      </section>
      {data.isStaff && <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("bikes.searchPh")} aria-label={t("bikes.searchPh")} />}
      <p className="text-sm text-muted-foreground">{faNumber(items.length)} {t("bikes.count")}</p>
      {items.length === 0 ? (
        <EmptyState title={t("bikes.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{r.kind}{r.color ? ` · ${r.color}` : ""}</p>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("bikes.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">
                {r.studentName}{r.className ? ` · ${r.className}` : ""}
                {r.serial ? ` · ${t("bikes.f.serial")}: ${r.serial}` : ""}
                {r.spot ? ` · ${t("bikes.f.spot")}: ${r.spot}` : ""}
              </p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
