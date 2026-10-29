"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DoorOpen, Plus, Loader2, Check, X, LogOut, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayKey } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Pass = {
  id: string; date: string; exitTime: string | null; reason: string; pickupBy: string | null; status: string;
  student?: { id: string; user?: { firstName: string; lastName: string }; class?: { name: string } | null };
};
type MyStudent = { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };
type Data = { staff: boolean; date: string; passes: Pass[]; myStudents?: MyStudent[] };

const STATUS: Record<string, { tkey: string; cls: string }> = {
  PENDING: { tkey: "enum.gatePassStatus.PENDING", cls: "b-badge-warning" },
  APPROVED: { tkey: "enum.gatePassStatus.APPROVED", cls: "b-badge-spring" },
  REJECTED: { tkey: "enum.gatePassStatus.REJECTED", cls: "b-badge-critical" },
  EXITED: { tkey: "enum.gatePassStatus.EXITED", cls: "b-badge-neutral" },
};

export default function GatePassesPage() {
  const { t } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [date, setDate] = useState(todayKey());
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [exitTime, setExitTime] = useState("");
  const [reason, setReason] = useState("");
  const [pickupBy, setPickupBy] = useState("");
  const [studentTerm, setStudentTerm] = useState("");
  const [studentHits, setStudentHits] = useState<MyStudent[]>([]);

  const load = useCallback((d: string) => {
    apiGet<Data>(`/api/gate-passes?date=${encodeURIComponent(d)}`).then(setData).catch(() => setData({ staff: false, date: d, passes: [] }));
  }, []);
  useEffect(() => { load(date); }, [load, date]);

  useEffect(() => {
    if (!open || !data?.staff || studentTerm.trim().length < 2) { setStudentHits([]); return; }
    const t = setTimeout(() => {
      apiGet<{ students: MyStudent[] }>(`/api/students?q=${encodeURIComponent(studentTerm.trim())}`).then((d) => setStudentHits(d.students ?? [])).catch(() => setStudentHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [open, data?.staff, studentTerm]);

  async function decide(p: Pass, status: string) {
    setBusy(p.id);
    try { await apiPatch("/api/gate-passes", { id: p.id, status }); toast.success(t("gatePasses.anjam-shd")); load(date); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function create() {
    if (!studentId) { toast.error(t("gatePasses.dansh-amvz-ra-antkhab-knyd")); return; }
    if (!reason.trim()) { toast.error(t("gatePasses.dlyl-khrvj-ra-bnvysyd")); return; }
    setBusy("create");
    try {
      await apiPost("/api/gate-passes", { studentId, date, exitTime: exitTime || undefined, reason, pickupBy: pickupBy || undefined });
      toast.success(t("gatePasses.mjvz-sbt-shd"));
      setOpen(false); setStudentId(""); setReason(""); setExitTime(""); setPickupBy(""); setStudentTerm("");
      load(date);
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label={t("gatePasses.mjvzhay-khrvj")} />;
  const students = data.staff ? studentHits : (data.myStudents ?? []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("gatePasses.mjvz-khrvj-dansh-amvz")}
        desc={data.staff ? t("gatePasses.drkhvast-hay-khrvj-zvdhngam-amrvz-t-yyd-rd-v-sbt-khrvj-nhayy-dr") : t("gatePasses.drkhvast-khrvj-zvdhngam-bray-khvdtan-frzndtan-v-pygyry-vzayt")}
        action={<button className="b-btn b-btn-spring" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> {t("gatePasses.drkhvast-jdyd")}</button>}
      />
      <div className="flex items-center gap-3">
        <label className="text-[12.5px] font-bold">{t("common.date")} ({t("gatePasses.shmsy")}):</label>
        <input className="b-input !w-44" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>

      {data.passes.length === 0
        ? <EmptyState icon={DoorOpen} title={t("gatePasses.mjvzy-bray-ayn-rvz-nyst")} desc={t("gatePasses.drkhvasty-sbt-nshdh-ast")} />
        : <section className="b-card p-5 md:p-6">
            <div className="flex flex-col divide-y divide-hairline-soft b-rows-in">
              {data.passes.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="flex-1 min-w-48">
                    <b className="text-[13.5px]">{p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : ""}</b>
                    {p.student?.class && <span className="t-cap text-steel"> · {p.student.class.name}</span>}
                    <span className="t-sm text-steel block">{p.reason}{p.exitTime ? ` ${t("gatePasses.saat")} ${p.exitTime}` : ""}{p.pickupBy ? ` ${t("gatePasses.thvyl-bh")} ${p.pickupBy}` : ""}</span>
                  </div>
                  <span className={`b-badge ${STATUS[p.status]?.cls ?? "b-badge-neutral"}`}>{STATUS[p.status] ? t(STATUS[p.status].tkey) : p.status}</span>
                  {data.staff && (
                    <button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label={t("gatePasses.hzf-mjvz")} onClick={async () => { if (!window.confirm(t("gatePasses.ayn-mjvz-khrvj-hzf-shvd"))) return; try { await apiDelete(`/api/gate-passes?id=${p.id}`); toast.success(t("gatePasses.hzf-shd")); load(date); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  {data.staff && p.status === "PENDING" && (
                    <span className="flex gap-1.5">
                      <button className="b-btn b-btn-soft b-btn-sm" disabled={busy === p.id} onClick={() => decide(p, "APPROVED")}><Check className="w-3.5 h-3.5" /> {t("gatePasses.t-yyd")}</button>
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === p.id} onClick={() => decide(p, "REJECTED")}><X className="w-3.5 h-3.5" /> {t("gatePasses.rd")}</button>
                    </span>
                  )}
                  {data.staff && p.status === "APPROVED" && (
                    <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === p.id} onClick={() => decide(p, "EXITED")}><LogOut className="w-3.5 h-3.5" /> {t("gatePasses.sbt-khrvj")}</button>
                  )}
                </div>
              ))}
            </div>
          </section>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="b-card w-full max-w-md p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{t("gatePasses.drkhvast-mjvz-khrvj")}</h3>
            {data.staff ? (
              <>
                <input className="b-input" placeholder={t("gatePasses.jstjvy-nam-dansh-amvz")} value={studentTerm} onChange={(e) => { setStudentTerm(e.target.value); setStudentId(""); }} />
                {students.length > 0 && !studentId && (
                  <div className="flex flex-col gap-1 max-h-40 overflow-y-auto b-scroll">
                    {students.map((s) => (
                      <button key={s.id} className="b-btn b-btn-ghost b-card-sm !rounded-full p-2.5 text-start text-[13px]" onClick={() => setStudentId(s.id)}>
                        <b>{s.user.firstName} {s.user.lastName}</b> <span className="text-steel">{s.class?.name ?? ""}</span>
                      </button>
                    ))}
                  </div>
                )}
                {studentId && <p className="t-sm text-spring-deep">{t("gatePasses.dansh-amvz-antkhab-shd")}</p>}
              </>
            ) : (
              <Select
                value={studentId}
                onChange={setStudentId}
                placeholder={t("gatePasses.antkhab-dansh-amvz")}
                options={(data.myStudents ?? []).map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}${s.class ? ` — ${s.class.name}` : ""}` }))}
                ariaLabel={t("common.student")}
              />
            )}
            <input className="b-input" placeholder={t("gatePasses.saat-khrvj-msla-12-30")} dir="ltr" value={exitTime} onChange={(e) => setExitTime(e.target.value)} />
            <input className="b-input" placeholder={t("gatePasses.dlyl-khrvj")} value={reason} onChange={(e) => setReason(e.target.value)} />
            <input className="b-input" placeholder={t("gatePasses.thvyl-gyrndh-pdr-madr")} value={pickupBy} onChange={(e) => setPickupBy(e.target.value)} />
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "create"} onClick={create}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("gatePasses.sbt-drkhvast")}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
