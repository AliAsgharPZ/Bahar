"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Video, Plus, Loader2, Trash2, ExternalLink } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Session = {
  id: string; title: string; provider: string; link: string; startsAt: string; durationMin: number;
  classId: string | null; className: string | null; subjectName: string | null; mine: boolean;
};
type Data = { sessions: Session[]; canCreate: boolean };
type ClassRow = { id: string; name: string };

const PROVIDER_LABEL: Record<string, string> = { SKYROOM: "virtualSessions.provider.skyroom", BBB: "virtualSessions.provider.bbb", SHAD: "virtualSessions.provider.shad", OTHER: "virtualSessions.provider.other" };

export default function VirtualSessionsPage() {
  const { t } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [when, setWhen] = useState("");
  const [duration, setDuration] = useState("45");
  const [provider, setProvider] = useState("SKYROOM");
  const [classId, setClassId] = useState("");

  const load = useCallback(() => { apiGet<Data>("/api/virtual-sessions").then(setData).catch(() => setData({ sessions: [], canCreate: false })); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiGet<{ classes: ClassRow[] }>("/api/classes").then((d) => setClasses(d.classes ?? [])).catch(() => setClasses([]));
  }, []);

  async function create() {
    if (!title.trim()) { toast.error(t("virtualSessions.titleRequired")); return; }
    if (!/^https?:\/\//i.test(link.trim())) { toast.error(t("virtualSessions.linkHttp")); return; }
    setBusy("create");
    try {
      await apiPost("/api/virtual-sessions", {
        title, link,
        startsAt: when ? new Date(when).toISOString() : undefined,
        durationMin: Number(duration) || 45,
        provider, classId: classId || undefined,
      });
      toast.success(t("virtualSessions.created"));
      setOpen(false); setTitle(""); setLink(""); setWhen(""); setClassId("");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function remove(s: Session) {
    if (!confirm(`${t("virtualSessions.deletePrefix")}${s.title}${t("virtualSessions.deleteSuffix")}`)) return;
    setBusy(s.id);
    try { await apiDelete(`/api/virtual-sessions?id=${encodeURIComponent(s.id)}`); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label={t("virtualSessions.loading")} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.virtualSessions")}
        desc={t("virtualSessions.desc")}
        action={data.canCreate ? <button className="b-btn b-btn-spring" onClick={() => setOpen(true)}><Plus className="w-4 h-4" /> {t("virtualSessions.new")}</button> : undefined}
      />
      {data.sessions.length === 0
        ? <EmptyState icon={Video} title={t("virtualSessions.empty.title")} desc={t("virtualSessions.empty.desc")} />
        : <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
            {data.sessions.map((s) => {
              const d = new Date(s.startsAt);
              const live = Math.abs(Date.now() - d.getTime()) < s.durationMin * 60_000 && Date.now() >= d.getTime() - 10 * 60_000;
              return (
                <div key={s.id} className="b-card b-card-hover p-5 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <b className="text-[15px]">{s.title}</b>
                    {live && <span className="b-badge b-badge-critical">{t("virtualSessions.live")}</span>}
                  </div>
                  <p className="t-sm text-steel">
                    {d.toLocaleDateString("fa-IR")} — {t("common.time")} {d.toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" })}
                    {" · "}{faNumber(s.durationMin)} {t("dashboard.uptime.minute")}{" · "}{t(PROVIDER_LABEL[s.provider] ?? s.provider)}
                  </p>
                  <p className="t-sm text-steel">{s.className ? `${t("virtualSessions.classPrefix")} ${s.className}` : t("virtualSessions.allSchool")}{s.subjectName ? ` · ${s.subjectName}` : ""}</p>
                  <div className="flex gap-2 mt-1">
                    <a className="b-btn b-btn-spring b-btn-sm" href={s.link} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /> {t("virtualSessions.join")}</a>
                    {(s.mine || data.canCreate) && (
                      <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === s.id} onClick={() => remove(s)}><Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>}

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setOpen(false)}>
          <div className="b-card w-full max-w-md p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{t("virtualSessions.modalTitle")}</h3>
            <input className="b-input" placeholder={t("virtualSessions.form.title")} value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="b-input" placeholder={t("virtualSessions.form.link")} dir="ltr" value={link} onChange={(e) => setLink(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className="b-input" type="datetime-local" dir="ltr" value={when} onChange={(e) => setWhen(e.target.value)} />
              <input className="b-input" placeholder={t("virtualSessions.form.duration")} inputMode="numeric" value={duration} onChange={(e) => setDuration(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select value={provider} onChange={setProvider} options={Object.entries(PROVIDER_LABEL).map(([value, label]) => ({ value, label: t(label) }))} ariaLabel={t("virtualSessions.form.provider")} />
              <Select value={classId} onChange={setClassId} placeholder={t("virtualSessions.allSchool")} options={[{ value: "", label: t("virtualSessions.allSchool") }, ...classes.map((c) => ({ value: c.id, label: c.name }))]} ariaLabel={t("common.class")} />
            </div>
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "create"} onClick={create}>{busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("virtualSessions.create")}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
