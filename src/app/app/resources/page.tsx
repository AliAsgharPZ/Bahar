"use client";

import { useCallback, useEffect, useState } from "react";
import { Link2, Plus, Trash2, Youtube, BookOpen, Globe, GraduationCap, FileText } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Resource = { id: string; title: string; url: string; description: string | null; kind: string; grade: string | null; topic: string | null; subject: { name: string } | null; addedBy: { firstName: string; lastName: string } | null };
const KINDS: Record<string, { label: string; icon: typeof Globe }> = {
  VIDEO: { label: "resources.kind.video", icon: Youtube }, ARTICLE: { label: "resources.kind.article", icon: FileText },
  BOOK: { label: "resources.kind.book", icon: BookOpen }, SITE: { label: "resources.kind.site", icon: Globe }, PRACTICE: { label: "resources.kind.practice", icon: GraduationCap },
};

export default function ResourcesPage() {
  const { t } = useLang();
  const [resources, setResources] = useState<Resource[]>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [form, setForm] = useState({ title: "", url: "", description: "", subjectId: "", kind: "VIDEO", topic: "" });
  const [filterSubject, setFilterSubject] = useState("");

  const load = useCallback(() => {
    apiGet<{ resources: Resource[]; subjects: Array<{ id: string; name: string }> }>(`/api/resources${filterSubject ? `?subjectId=${filterSubject}` : ""}`)
      .then((d) => { setLoadError(""); setResources(d.resources); setSubjects(d.subjects); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t("resources.loadError")))
      .finally(() => setLoading(false));
  }, [filterSubject]);
  useEffect(load, [load]);
  useEffect(() => {
    apiGet<{ user: { role: string } }>("/api/auth/me")
      .then((d) => setIsStaff(["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"].includes(d.user.role)))
      .catch(() => setIsStaff(false));
  }, []);

  async function submit() {
    if (!form.title.trim() || !form.url.trim()) { toast.error(t("resources.titleLinkRequired")); return; }
    try {
      await apiPost("/api/resources", { ...form, subjectId: form.subjectId || undefined });
      toast.success(t("resources.added"));
      setForm({ title: "", url: "", description: "", subjectId: "", kind: "VIDEO", topic: "" }); setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function remove(id: string) {
    try { await apiDelete(`/api/resources?id=${id}`); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title={t("nav.resources")}
        desc={t("resources.desc")}
        action={isStaff && <button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("resources.add")}</button>}
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-3">
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder={t("resources.form.title")} className="b-input" />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={t("resources.form.url")} className="b-input sm:col-span-2" dir="ltr" />
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={Object.entries(KINDS).map(([k, v]) => ({ value: k, label: t(v.label) }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <Select
            value={form.subjectId}
            onChange={(v) => setForm({ ...form, subjectId: v })}
            options={[{ value: "", label: t("resources.form.subject") }, ...subjects.map((s) => ({ value: s.id, label: s.name }))]}
            placeholder={t("resources.form.subject")}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder={t("resources.form.topic")} className="b-input" />
          <button onClick={submit} className="b-btn b-btn-sm b-btn-spring sm:col-span-3 w-fit">{t("resources.form.submit")}</button>
        </div>
      )}
      {subjects.length > 0 && (
        <div className="flex gap-1.5 mb-5 overflow-x-auto b-scroll pb-1">
          <button onClick={() => setFilterSubject("")} className={`b-pill-tab ${!filterSubject ? "b-pill-tab-active" : ""}`}>{t("common.all")}</button>
          {subjects.map((s) => (
            <button key={s.id} onClick={() => setFilterSubject(s.id)} className={`b-pill-tab ${filterSubject === s.id ? "b-pill-tab-active" : ""}`}>{s.name}</button>
          ))}
        </div>
      )}
      {resources.length === 0 ? <EmptyState icon={Link2} title={t("resources.empty")} /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((r, i) => {
            const k = KINDS[r.kind] ?? KINDS.ARTICLE;
            return (
              <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="b-card-sm p-4 hover:shadow-md transition-shadow group">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="w-9 h-9 rounded-xl bg-spring-tint text-spring-deep flex items-center justify-center shrink-0"><k.icon className="w-4.5 h-4.5 w-5 h-5" /></span>
                  <span className="b-badge b-badge-spring">{t(k.label)}</span>
                  {isStaff && (
                    <button onClick={(e) => { e.preventDefault(); remove(r.id); }} className="b-btn b-btn-ghost opacity-0 group-hover:opacity-100 max-md:opacity-100 text-stone hover:text-destructive ms-auto">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-[13.5px] font-bold group-hover:text-spring-deep transition-colors">{r.title}</p>
                {r.description && <p className="text-[11.5px] text-steel line-clamp-2 mt-1">{r.description}</p>}
                <p className="text-[10.5px] text-stone mt-2">{r.subject?.name ?? t("resources.general")}{r.topic ? ` · ${r.topic}` : ""}</p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
