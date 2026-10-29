"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Leave = { id: string; kind: string; fromDate: string; toDate: string; reason: string | null; status: string; reviewNote: string | null; createdAt: string; user: { firstName: string; lastName: string; role: string } };
const KIND_TKEY: Record<string, string> = { PERSONAL: "nav.group.personal", SICK: "enum.leaveKind.SICK", MISSION: "enum.leaveKind.MISSION", UNPAID: "enum.leaveKind.UNPAID" };
const STATUS_TKEY: Record<string, string> = { PENDING: "dashboard.meeting.pending", APPROVED: "dashboard.meeting.approved", REJECTED: "enum.leaveStatus.REJECTED" };

export default function LeavesPage() {
  const { t } = useLang();
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ kind: "PERSONAL", fromDate: "", toDate: "", reason: "" });

  const load = useCallback(() => {
    apiGet<{ leaves: Leave[]; kinds: Record<string, string>; canReview: boolean }>("/api/leaves")
      .then((d) => { setLoadError(""); setLeaves(d.leaves); setKinds(d.kinds); setCanReview(d.canReview); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t("leaves.khta-dr-bargzary-mrkhsy-ha")))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function submit() {
    if (!form.fromDate || !form.toDate) { toast.error(t("leaves.bazh-tarykh-lazm-ast")); return; }
    try {
      await apiPost("/api/leaves", { action: "request", ...form });
      toast.success(t("leaves.drkhvast-sbt-shd-v-bh-mdyr-atlaa-dadh-shd"));
      setForm({ kind: "PERSONAL", fromDate: "", toDate: "", reason: "" }); setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function respond(id: string, status: string) {
    try { await apiPost("/api/leaves", { action: "respond", leaveId: id, status }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title={t("nav.leaves")}
        desc={canReview ? t("leaves.drkhvast-hay-mrkhsy-karknan-mdrsh") : t("leaves.drkhvast-hay-mrkhsy-shma")}
        action={<button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("leaves.drkhvast-mrkhsy")}</button>}
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-4">
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={Object.entries(kinds).map(([k, v]) => ({ value: k, label: v }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="b-input" title={t("leaves.az-tarykh")} />
          <input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="b-input" title={t("leaves.ta-tarykh")} />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder={t("leaves.dlyl")} className="b-input" />
          <button onClick={submit} className="b-btn b-btn-sm b-btn-spring sm:col-span-4 w-fit">{t("leaves.sbt-drkhvast")}</button>
        </div>
      )}
      {leaves.length === 0 ? <EmptyState icon={CalendarOff} title={t("leaves.mrkhsy-sbt-nshdh")} /> : (
        <div className="flex flex-col gap-2.5">
          {leaves.map((l) => (
            <div key={l.id} className="b-card-sm p-4 flex items-center gap-3 flex-wrap">
              <span className={`b-badge ${l.status === "APPROVED" ? "b-badge-success" : l.status === "REJECTED" ? "b-badge-critical" : "b-badge-warning"}`}>{t(STATUS_TKEY[l.status] ?? l.status)}</span>
              {canReview && <span className="text-[14px] font-bold">{l.user.firstName} {l.user.lastName}</span>}
              <span className="b-badge b-badge-neutral">{t(KIND_TKEY[l.kind] ?? l.kind)}</span>
              <span className="text-[12px] text-steel">{formatDateFa(l.fromDate)} {t("common.to")} {formatDateFa(l.toDate)}</span>
              {l.reason && <span className="text-[12px] text-steel flex-1 truncate">{l.reason}</span>}
              {l.reviewNote && <span className="text-[12px] text-spring-deep">{l.reviewNote}</span>}
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive ms-auto" onClick={async () => { if (!window.confirm(t("leaves.ayn-drkhvast-mrkhsy-hzf-shvd"))) return; try { await apiDelete(`/api/leaves?id=${l.id}`); toast.success(t("leaves.hzf-shd")); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>{t("common.delete")}</button>
              {canReview && l.status === "PENDING" && (
                <span className="flex gap-1.5 ms-auto">
                  <button onClick={() => respond(l.id, "APPROVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2.5 !py-0"><CheckCircle2 className="w-3.5 h-3.5" /> {t("leaves.t-yyd")}</button>
                  <button onClick={() => respond(l.id, "REJECTED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2.5 !py-0 !text-destructive"><XCircle className="w-3.5 h-3.5" /> {t("leaves.rd")}</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
