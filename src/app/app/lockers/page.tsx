"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Lock, Loader2, Trash2 } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = { id: string; number: string; location: string | null; status: string; note: string | null; studentId: string | null; studentName: { user: { firstName: string; lastName: string }; class: { name: true } | null } | null };
type Data = { items: Row[]; freeCount: number };

export default function LockersPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/lockers");
  const [number, setNumber] = useState("");
  const [location, setLocation] = useState("");
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const create = async () => {
    if (!number.trim()) { toast.error(t("lockers.f.number")); return; }
    setBusy(true);
    try { await apiPost("/api/lockers", { number, location: location || undefined }); setNumber(""); setLocation(""); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const setStudent = async (id: string, studentId: string | null) => {
    try { await apiPatch("/api/lockers", { id, studentId }); toast.success(t("lockers.savedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    try { await apiDelete(`/api/lockers?id=${id}`); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("lockers.title")} desc={t("lockers.desc")} />
      <section className="b-card p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><Lock className="w-5 h-5" /> {t("lockers.addTitle")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <input className="b-input w-full" value={number} onChange={(e) => setNumber(e.target.value)} placeholder={t("lockers.f.number")} />
          <input className="b-input w-full" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t("lockers.f.location")} />
        </div>
        <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={create}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} {t("lockers.add")}
        </button>
        <p className="text-sm text-muted-foreground">{faNumber(data.freeCount)} {t("lockers.free")}</p>
      </section>

      {data.items.length === 0 ? (
        <EmptyState title={t("lockers.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((r) => (
            <article key={r.id} className="b-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <p className="font-bold flex-1">{t("lockers.locker")} {r.number}</p>
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "FREE" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                  {r.status === "FREE" ? t("lockers.free") : t("lockers.taken")}
                </span>
                <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)} aria-label={t("lockers.delete")}><Trash2 className="w-4 h-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground">
                {r.location ?? ""}{r.studentName ? ` · ${r.studentName.user.firstName} ${r.studentName.user.lastName}` : ""}
              </p>
              <div className="flex gap-2">
                <input
                  className="b-input min-h-11 flex-1"
                  dir="ltr"
                  value={assign[r.id] ?? r.studentId ?? ""}
                  onChange={(e) => setAssign((s) => ({ ...s, [r.id]: e.target.value }))}
                  placeholder={t("lockers.studentIdPh")}
                  aria-label={t("lockers.studentIdPh")}
                />
                <button className="b-btn b-btn-primary min-h-11" onClick={() => setStudent(r.id, (assign[r.id] ?? "").trim() || null)}>
                  {t("lockers.assign")}
                </button>
                {r.studentId && <button className="b-btn b-btn-ghost min-h-11" onClick={() => setStudent(r.id, null)}>{t("lockers.release")}</button>}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
