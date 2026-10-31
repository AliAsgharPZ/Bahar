"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; studentId: string; name: string; relation: string; phone: string | null; carPlate: string | null; isAuthorized: boolean; studentName: string; className: string | null };
type Data = { isStaff: boolean; items: Row[] };

export default function PickupPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/pickup");
  const [studentId, setStudentId] = useState("");
  const { data: kidsData } = useApi<{ students: { id: string; user: { firstName: string; lastName: string } }[] }>("/api/students?take=1");
  const [name, setName] = useState("");
  const [relation, setRelation] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const add = async () => {
    const sid = data.isStaff ? studentId : kidsData?.students?.[0]?.id;
    if (!sid || !name.trim() || !relation.trim()) { toast.error(t("pickup.f.name")); return; }
    setBusy(true);
    try {
      await apiPost("/api/pickup", { studentId: sid, name, relation, phone: phone || undefined, carPlate: plate || undefined });
      setName(""); setRelation(""); setPhone(""); setPlate("");
      toast.success(t("pickup.addedToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const toggle = async (r: Row) => {
    try { await apiPatch("/api/pickup", { id: r.id, isAuthorized: !r.isAuthorized }); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/pickup?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const items = data.items.filter((r) => !q || r.studentName.includes(q) || r.name.includes(q) || (r.carPlate ?? "").includes(q));

  return (
    <div className="space-y-6">
      <PageHeader title={t("pickup.title")} desc={t("pickup.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> {t("pickup.addTitle")}</h2>
        {data.isStaff && (
          <input className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder={t("pickup.f.studentId")} dir="ltr" aria-label={t("pickup.f.studentId")} />
        )}
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("pickup.f.name")} />
          <input className="b-input w-full" value={relation} onChange={(e) => setRelation(e.target.value)} placeholder={t("pickup.f.relation")} />
          <input className="b-input w-full" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("pickup.f.phone")} />
          <input className="b-input w-full" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={t("pickup.f.plate")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} {t("pickup.add")}
        </button>
      </section>

      <input className="b-input w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("pickup.searchPh")} aria-label={t("pickup.searchPh")} />

      {items.length === 0 ? (
        <EmptyState title={t("pickup.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.name} <span className="text-muted-foreground text-sm">({r.relation})</span></p>
                <p className="text-sm text-muted-foreground">
                  {t("pickup.forStudent")} {r.studentName}{r.className ? ` · ${r.className}` : ""}
                  {r.phone ? ` · ${faNumber(r.phone)}` : ""}{r.carPlate ? ` · ${t("pickup.f.plate")}: ${r.carPlate}` : ""}
                </p>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-xs ${r.isAuthorized ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {r.isAuthorized ? t("pickup.authorized") : t("pickup.notAuthorized")}
              </span>
              <button className="b-btn b-btn-ghost min-h-11" onClick={() => toggle(r)}>{r.isAuthorized ? t("pickup.revoke") : t("pickup.grant")}</button>
              <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("pickup.delete")}><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
