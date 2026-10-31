"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Megaphone, CheckCircle2, XCircle, Eye } from "lucide-react";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { EmptyState } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type SummonRow = {
  id: string; studentId: string; parentUserId?: string; reason: string; whenText: string; status: string;
  studentName: string; className: string; parentName?: string; createdAt: string;
};
type StudentOpt = { id: string; name: string; className: string; parents: { userId: string; name: string }[] };
type SummonsData = { summons: SummonRow[]; students?: StudentOpt[] };

export function SummonsSection({ preset }: { preset: { studentId: string; n: number } | null }) {
  const { t } = useLang();
  const { data, refetch } = useApi<SummonsData>("/api/parent-summons");
  const [studentId, setStudentId] = useState("");
  const [parentUserId, setParentUserId] = useState("");
  const [reason, setReason] = useState("");
  const [whenText, setWhenText] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    if (preset?.studentId) setStudentId(preset.studentId);
  }, [preset]);

  if (!data) return null;
  const isParent = data.students === undefined;
  const students = data.students ?? [];
  const selected = students.find((s) => s.id === studentId);
  const parentId = parentUserId || selected?.parents[0]?.userId || "";

  const send = async () => {
    if (!studentId || !parentId || reason.trim().length < 3 || !whenText.trim()) {
      toast.error(t("common.error"));
      return;
    }
    setBusy("send");
    try {
      await apiPost("/api/parent-summons", { studentId, parentUserId: parentId, reason: reason.trim(), whenText: whenText.trim() });
      toast.success(t("summons.sent"));
      setReason("");
      setWhenText("");
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy("");
    }
  };

  const act = async (id: string, action: "ACK" | "DONE" | "CANCEL") => {
    setBusy(id);
    try {
      await apiPatch("/api/parent-summons", { id, action });
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy("");
    }
  };

  const badge = (s: string) =>
    s === "DONE" ? <span className="b-badge b-badge-success">{t("summons.status.DONE")}</span>
    : s === "CANCELLED" ? <span className="b-badge b-badge-danger">{t("summons.status.CANCELLED")}</span>
    : s === "ACKED" ? <span className="b-badge b-badge-neutral">{t("summons.status.ACKED")}</span>
    : <span className="b-badge b-badge-warning">{t("summons.status.PENDING")}</span>;

  return (
    <div className="b-card p-5 flex flex-col gap-3" id="summons">
      <h3 className="font-bold text-[15px] flex items-center gap-2">
        <Megaphone className="w-4.5 h-4.5" />
        {t("summons.title")}
      </h3>
      <p className="text-[12px] text-steel leading-5">{t("summons.desc")}</p>

      {!isParent && (
        <div className="b-card-sm p-3.5 flex flex-col gap-2.5">
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-44">
              {t("summons.student")}
              <select className="b-input !h-11" value={studentId} onChange={(e) => { setStudentId(e.target.value); setParentUserId(""); }}>
                <option value="">—</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.className ? ` · ${s.className}` : ""}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-44">
              {t("summons.parent")}
              <select className="b-input !h-11" value={parentId} onChange={(e) => setParentUserId(e.target.value)} disabled={!selected}>
                {(selected?.parents ?? []).map((p) => (
                  <option key={p.userId} value={p.userId}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          {selected && selected.parents.length === 0 && (
            <p className="text-[12px] text-destructive">{t("summons.noParent")}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <input className="b-input !h-11 flex-1 min-w-52" placeholder={t("summons.reasonPlaceholder")} value={reason} onChange={(e) => setReason(e.target.value)} aria-label={t("summons.reason")} />
            <input className="b-input !h-11 flex-1 min-w-52" placeholder={t("summons.whenPlaceholder")} value={whenText} onChange={(e) => setWhenText(e.target.value)} aria-label={t("summons.when")} />
            <button type="button" className="b-btn b-btn-primary !h-11" disabled={busy === "send" || !selected || selected.parents.length === 0} onClick={send}>
              {busy === "send" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
              {t("summons.send")}
            </button>
          </div>
        </div>
      )}

      {data.summons.length === 0 ? (
        <EmptyState title={t("summons.empty")} />
      ) : (
        data.summons.map((s) => (
          <div key={s.id} className="b-card-sm p-3.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13px]">{s.studentName}</b>
              {s.className ? <span className="text-[12px] text-steel">{s.className}</span> : null}
              {s.parentName ? <span className="text-[12px] text-steel">— {s.parentName}</span> : null}
              <span className="ms-auto">{badge(s.status)}</span>
            </div>
            <p className="text-[13px] leading-6">{s.reason}</p>
            <p className="text-[12px] text-steel">{t("summons.when")}: {s.whenText}</p>
            <div className="flex items-center gap-2">
              {isParent && s.status === "PENDING" && (
                <button type="button" className="b-btn b-btn-primary !h-10" disabled={busy === s.id} onClick={() => act(s.id, "ACK")}>
                  {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                  {t("summons.ack")}
                </button>
              )}
              {!isParent && (s.status === "PENDING" || s.status === "ACKED") && (
                <>
                  <button type="button" className="b-btn b-btn-primary !h-10" disabled={busy === s.id} onClick={() => act(s.id, "DONE")}>
                    <CheckCircle2 className="w-4 h-4" />
                    {t("summons.done")}
                  </button>
                  <button type="button" className="b-btn b-btn-ghost !h-10" disabled={busy === s.id} onClick={() => act(s.id, "CANCEL")}>
                    <XCircle className="w-4 h-4" />
                    {t("summons.cancel")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
