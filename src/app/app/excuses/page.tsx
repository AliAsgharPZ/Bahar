"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FileQuestion, Loader2, Send, CheckCircle2, XCircle, Clock3, Megaphone } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { SummonsSection } from "@/components/summons-section";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type ExcuseRow = {
  id: string; studentId: string; date: string; text: string; status: string;
  studentName: string; parentName?: string; createdAt: string;
};
type OpenAbsence = { studentId: string; date: string; studentName: string };
type ExcusesData = {
  excuses: ExcuseRow[];
  openAbsences?: OpenAbsence[];
  children?: { id: string; name: string }[];
};

export default function ExcusesPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<ExcusesData>("/api/absence-excuses");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [busyKey, setBusyKey] = useState("");
  const [tab, setTab] = useState<"PENDING" | "ALL">("PENDING");
  const [summonPreset, setSummonPreset] = useState<{ studentId: string; n: number } | null>(null);
  const staff = useApi<ExcusesData>(tab === "ALL" ? "/api/absence-excuses?status=ALL" : null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const isParent = data.openAbsences !== undefined;
  const rows = isParent ? data.excuses : tab === "ALL" ? (staff.data?.excuses ?? []) : data.excuses;

  const submit = async (a: OpenAbsence) => {
    const key = `${a.studentId}|${a.date}`;
    const text = (texts[key] ?? "").trim();
    if (text.length < 3) {
      toast.error(t("excuses.err.text"));
      return;
    }
    setBusyKey(key);
    try {
      await apiPost("/api/absence-excuses", { studentId: a.studentId, date: a.date, text });
      toast.success(t("excuses.toast.sent"));
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusyKey("");
    }
  };

  const decide = async (id: string, decision: "APPROVE" | "REJECT") => {
    setBusyKey(id);
    try {
      await apiPatch("/api/absence-excuses", { id, decision });
      toast.success(decision === "APPROVE" ? t("excuses.toast.approved") : t("excuses.toast.rejected"));
      refetch();
      staff.refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusyKey("");
    }
  };

  const statusBadge = (s: string) =>
    s === "APPROVED" ? (
      <span className="b-badge b-badge-success">{t("excuses.status.APPROVED")}</span>
    ) : s === "REJECTED" ? (
      <span className="b-badge b-badge-danger">{t("excuses.status.REJECTED")}</span>
    ) : (
      <span className="b-badge b-badge-warning">{t("excuses.status.PENDING")}</span>
    );

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("excuses.title")} desc={t("excuses.desc")} />

      {isParent && (
        <div className="b-card p-5 flex flex-col gap-3">
          <h3 className="font-bold text-[15px]">{t("excuses.openTitle")}</h3>
          {(data.openAbsences ?? []).length === 0 ? (
            <p className="text-[13px] text-steel">{t("excuses.openEmpty")}</p>
          ) : (
            (data.openAbsences ?? []).map((a) => {
              const key = `${a.studentId}|${a.date}`;
              return (
                <div key={key} className="b-card-sm p-3.5 flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="text-[13px]">{a.studentName}</b>
                    <span className="b-badge b-badge-danger">{t("excuses.absentOn")} {faNumber(a.date)}</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <textarea
                      className="b-input flex-1 min-h-11 py-2"
                      rows={2}
                      placeholder={t("excuses.textPlaceholder")}
                      value={texts[key] ?? ""}
                      onChange={(e) => setTexts({ ...texts, [key]: e.target.value })}
                    />
                    <button
                      type="button"
                      className="b-btn b-btn-primary !h-11"
                      disabled={busyKey === key}
                      onClick={() => submit(a)}
                    >
                      {busyKey === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {t("excuses.send")}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {!isParent && (
        <div className="flex items-center gap-2" role="tablist" aria-label={t("excuses.title")}>
          {(["PENDING", "ALL"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`b-btn !h-10 ${tab === k ? "b-btn-primary" : "b-btn-ghost"}`}
            >
              {k === "PENDING" ? t("excuses.tab.pending") : t("excuses.tab.all")}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        {rows.length === 0 ? (
          <EmptyState title={t("excuses.empty")} />
        ) : (
          rows.map((e) => (
            <div key={e.id} className="b-card p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-[13px]">{e.studentName}</b>
                <span className="text-[12px] text-steel">
                  {t("excuses.absentOn")} {faNumber(e.date)}
                </span>
                {e.parentName ? <span className="text-[12px] text-steel">— {e.parentName}</span> : null}
                <span className="ms-auto">{statusBadge(e.status)}</span>
              </div>
              <p className="text-[13px] leading-6">{e.text}</p>
              {!isParent && e.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="b-btn b-btn-primary !h-10"
                    disabled={busyKey === e.id}
                    onClick={() => decide(e.id, "APPROVE")}
                  >
                    {busyKey === e.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {t("excuses.approve")}
                  </button>
                  <button
                    type="button"
                    className="b-btn b-btn-ghost !h-10"
                    disabled={busyKey === e.id}
                    onClick={() => decide(e.id, "REJECT")}
                  >
                    <XCircle className="w-4 h-4" />
                    {t("excuses.reject")}
                  </button>
                  <span className="text-[12px] text-steel flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5" />
                    {t("excuses.approveHint")}
                  </span>
                </div>
              )}
              {!isParent && (
                <div>
                  <button
                    type="button"
                    className="b-btn b-btn-ghost !h-10"
                    onClick={() => {
                      setSummonPreset({ studentId: e.studentId, n: Date.now() });
                      document.getElementById("summons")?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    <Megaphone className="w-4 h-4" />
                    {t("summons.fromExcuse")}
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <SummonsSection preset={summonPreset} />
    </div>
  );
}
