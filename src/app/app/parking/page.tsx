"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Car, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; ownerName: string; plate: string; kind: string; isActive: boolean; note: string | null };
type Data = { isStaff: boolean; items: Row[]; activeCount: number };

export default function ParkingPage() {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const { data, loading, error, refetch } = useApi<Data>(`/api/parking${q ? `?q=${encodeURIComponent(q)}` : ""}`, [q]);
  const [plate, setPlate] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [kind, setKind] = useState("PARENT");
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    if (!plate.trim()) { toast.error(t("parking.f.plate")); return; }
    setBusy(true);
    try { await apiPost("/api/parking", { plate, ownerName: ownerName || undefined, kind }); setPlate(""); setOwnerName(""); toast.success(t("parking.addedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const toggle = async (r: Row) => {
    try { await apiPatch("/api/parking", { id: r.id, isActive: !r.isActive }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/parking?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("parking.title")} desc={t("parking.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Car className="w-5 h-5" /> {t("parking.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <input className="b-input w-full" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={t("parking.f.plate")} />
          <input className="b-input w-full" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder={t("parking.f.owner")} />
          <select className="b-input w-full" value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t("parking.f.kind")}>
            <option value="PARENT">{t("parking.kind.PARENT")}</option>
            <option value="STAFF">{t("parking.kind.STAFF")}</option>
          </select>
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Car className="w-4 h-4" />} {t("parking.add")}
        </button>
      </section>
      <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("parking.searchPh")} aria-label={t("parking.searchPh")} />
      <p className="text-sm text-muted-foreground">{faNumber(data.activeCount)} {t("parking.activeCount")}</p>
      {data.items.length === 0 ? (
        <EmptyState title={t("parking.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <p className="font-bold" dir="ltr">{r.plate}</p>
              <p className="text-sm text-muted-foreground flex-1">{r.ownerName} · {t(`parking.kind.${r.kind}`)}{r.note ? ` · ${r.note}` : ""}</p>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.isActive ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                {r.isActive ? t("parking.active") : t("parking.inactive")}
              </span>
              <button className="b-btn b-btn-ghost min-h-11" onClick={() => toggle(r)}>{r.isActive ? t("parking.deactivate") : t("parking.activate")}</button>
              <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("parking.delete")}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
