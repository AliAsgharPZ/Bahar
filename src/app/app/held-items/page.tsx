"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Package, Loader2, Undo2 } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = {
  id: string; item: string; reason: string | null; status: string; createdAt: string;
  returnedAt: string | null; returnedTo: string | null;
  studentId: string; studentName: string; studentNumber: string; className: string | null;
};
type Data = { items: Row[]; classes: { id: string; name: string }[]; isStaff: boolean };
type StudentRow = { id: string; user: { firstName: string; lastName: string }; studentNumber: string };

function dateOf(iso: string) {
  const d = new Date(iso);
  return faNumber(d.toLocaleDateString("fa-IR"));
}

export default function HeldItemsPage() {
  const { t } = useLang();
  const [tab, setTab] = useState<"HELD" | "RETURNED">("HELD");
  const { data, loading, error, refetch } = useApi<Data>(`/api/held-items?status=${tab}`, [tab]);
  const [classId, setClassId] = useState("");
  const { data: studentsData } = useApi<{ students: StudentRow[] }>(classId ? `/api/students?classId=${classId}` : null, [classId]);
  const [studentId, setStudentId] = useState("");
  const [item, setItem] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [returnTo, setReturnTo] = useState<Record<string, string>>({});

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const take = async () => {
    if (!studentId || !item.trim()) { toast.error(t("heldItems.f.item")); return; }
    setBusy(true);
    try {
      await apiPost("/api/held-items", { studentId, item, reason: reason || undefined });
      setItem(""); setReason("");
      toast.success(t("heldItems.takenToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const giveBack = async (id: string) => {
    const to = (returnTo[id] ?? "").trim();
    if (!to) { toast.error(t("heldItems.returnedToPh")); return; }
    try {
      await apiPatch("/api/held-items", { id, returnedTo: to });
      toast.success(t("heldItems.returnedToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("heldItems.title")} desc={t("heldItems.desc")} />

      {data.isStaff && (
        <section className="b-card p-4 space-y-3">
          <h2 className="font-bold flex items-center gap-2"><Package className="w-5 h-5" /> {t("heldItems.takeTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <select className="b-input w-full" value={classId} onChange={(e) => { setClassId(e.target.value); setStudentId(""); }} aria-label={t("heldItems.f.classFirst")}>
              <option value="">{t("heldItems.f.classFirst")}</option>
              {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="b-input w-full" value={studentId} onChange={(e) => setStudentId(e.target.value)} aria-label={t("heldItems.f.student")} disabled={!classId}>
              <option value="">{t("heldItems.f.student")}</option>
              {(studentsData?.students ?? []).map((s) => (
                <option key={s.id} value={s.id}>{s.user.firstName} {s.user.lastName} — {faNumber(s.studentNumber)}</option>
              ))}
            </select>
            <input className="b-input w-full" value={item} onChange={(e) => setItem(e.target.value)} placeholder={t("heldItems.f.item")} />
            <input className="b-input w-full" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("heldItems.f.reason")} />
          </div>
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={take}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} {t("heldItems.take")}
          </button>
        </section>
      )}

      <div className="flex rounded-full border border-border overflow-hidden w-fit" role="tablist" aria-label={t("heldItems.title")}>
        {(["HELD", "RETURNED"] as const).map((s) => (
          <button key={s} role="tab" aria-selected={tab === s} className={`px-4 min-h-11 text-sm ${tab === s ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setTab(s)}>
            {s === "HELD" ? t("heldItems.heldTab") : t("heldItems.returnedTab")}
          </button>
        ))}
      </div>

      {data.items.length === 0 ? (
        <EmptyState title={t("heldItems.empty")} />
      ) : (
        <section className="b-card divide-y divide-border">
          {data.items.map((r) => (
            <div key={r.id} className="p-4 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-52">
                <p className="font-bold">{r.item}</p>
                <p className="text-sm text-muted-foreground">
                  {r.studentName}{r.className ? ` · ${r.className}` : ""} · {t("heldItems.takenAt")}: {dateOf(r.createdAt)}
                  {r.reason ? ` · ${r.reason}` : ""}
                  {r.status === "RETURNED" && r.returnedAt ? ` · ${t("heldItems.returnedAt")}: ${dateOf(r.returnedAt)} → ${r.returnedTo ?? ""}` : ""}
                </p>
              </div>
              {r.status === "HELD" && data.isStaff ? (
                <span className="flex items-center gap-2">
                  <input
                    className="b-input min-h-11"
                    value={returnTo[r.id] ?? ""}
                    onChange={(e) => setReturnTo((s) => ({ ...s, [r.id]: e.target.value }))}
                    placeholder={t("heldItems.returnedToPh")}
                    aria-label={t("heldItems.returnedToPh")}
                  />
                  <button className="b-btn b-btn-primary min-h-11" onClick={() => giveBack(r.id)}><Undo2 className="w-4 h-4" /> {t("heldItems.returnBtn")}</button>
                </span>
              ) : (
                <span className={`px-2 py-0.5 rounded-full text-xs ${r.status === "HELD" ? "bg-warning/15 text-warning" : "bg-success/15 text-success"}`}>
                  {t(`heldItems.status.${r.status}`)}
                </span>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
