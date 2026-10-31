"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { FileSignature, Loader2, Plus, Trash2, Printer, ChevronDown } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type StaffReq = { id: string; title: string; body: string; classId: string | null; deadline: string | null; targets: number; approved: number; declined: number };
type RosterRow = { studentId: string; studentName: string; className: string | null; parents: string[]; status: string; note: string | null };
type Detail = { request: { id: string; title: string; body: string; deadline: string | null }; roster: RosterRow[] };
type StaffData = { requests: StaffReq[]; classes: { id: string; name: string }[] };
type ParentItem = { requestId: string; title: string; body: string; deadline: string | null; studentId: string; studentName: string; className: string | null; status: string; note: string | null };
type Data = StaffData & { items?: ParentItem[] };

function StatusChip({ status, t }: { status: string; t: (k: string) => string }) {
  const label = status === "APPROVED" ? t("consents.status.APPROVED") : status === "DECLINED" ? t("consents.status.DECLINED") : t("consents.status.PENDING");
  const cls = status === "APPROVED" ? "bg-success/15 text-success" : status === "DECLINED" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning";
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{label}</span>;
}

export default function ConsentsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/consents");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [classId, setClassId] = useState("");
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: detail } = useApi<Detail>(openId ? `/api/consents?id=${openId}` : null, [openId]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [responding, setResponding] = useState<string | null>(null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const isParentView = Array.isArray(data.items);

  const create = async () => {
    if (!title.trim() || body.trim().length < 10) { toast.error(t("consents.f.body")); return; }
    setBusy(true);
    try {
      await apiPost("/api/consents", { title, body, classId: classId || undefined, deadline: deadline || undefined });
      setTitle(""); setBody(""); setClassId(""); setDeadline("");
      toast.success(t("consents.createdToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("consents.deleteConfirm"))) return;
    try { await apiDelete(`/api/consents?id=${id}`); toast.success(t("consents.deletedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const respond = async (item: ParentItem, status: "APPROVED" | "DECLINED") => {
    const key = `${item.requestId}:${item.studentId}`;
    setResponding(key);
    try {
      await apiPost("/api/consents/respond", { requestId: item.requestId, studentId: item.studentId, status, note: notes[key] || undefined });
      toast.success(t("consents.savedToast"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setResponding(null); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("consents.title")} desc={t("consents.desc")} />

      {!isParentView && (
        <>
          <section className="b-card p-4 space-y-3">
            <h2 className="font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {t("consents.createTitle")}</h2>
            <input className="b-input w-full" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("consents.f.title")} />
            <textarea className="b-input w-full min-h-28" value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("consents.f.bodyPh")} aria-label={t("consents.f.body")} />
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">{t("consents.f.class")}</span>
                <select className="b-input w-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">{t("consents.f.allSchool")}</option>
                  {data.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-sm text-muted-foreground">{t("consents.f.deadline")}</span>
                <input className="b-input w-full" dir="ltr" value={deadline} onChange={(e) => setDeadline(e.target.value)} placeholder="1405-09-20" />
              </label>
            </div>
            <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={create}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSignature className="w-4 h-4" />} {t("consents.create")}
            </button>
          </section>

          {data.requests.length === 0 ? (
            <EmptyState title={t("consents.empty")} />
          ) : (
            <section className="b-card divide-y divide-border">
              {data.requests.map((r) => (
                <div key={r.id} className="p-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="font-bold flex-1">{r.title}</p>
                    <span className="text-sm text-muted-foreground">
                      {faNumber(r.targets)} {t("consents.targets")} · {faNumber(r.approved)} {t("consents.approved")} · {faNumber(r.declined)} {t("consents.declined")} · {faNumber(Math.max(0, r.targets - r.approved - r.declined))} {t("consents.pending")}
                    </span>
                    <Link className="b-btn b-btn-ghost min-h-11" href={`/print/consents/${r.id}`} target="_blank"><Printer className="w-4 h-4" /> {t("consents.print")}</Link>
                    <button className="b-btn b-btn-ghost min-h-11" onClick={() => setOpenId(openId === r.id ? null : r.id)}>
                      <ChevronDown className="w-4 h-4" /> {t("consents.roster")}
                    </button>
                    <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /> {t("consents.delete")}</button>
                  </div>
                  {openId === r.id && detail && (
                    <ul className="divide-y divide-border border-t border-border pt-2">
                      {detail.roster.map((row) => (
                        <li key={row.studentId} className="py-2 flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-medium">{row.studentName}</span>
                          {row.className && <span className="text-muted-foreground">{row.className}</span>}
                          <span className="text-muted-foreground">{row.parents.join("، ")}</span>
                          <span className="ms-auto flex items-center gap-2">
                            {row.note && <span className="text-muted-foreground">{row.note}</span>}
                            <StatusChip status={row.status} t={t} />
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}

      {isParentView && (
        data.items!.length === 0 ? (
          <EmptyState title={t("consents.myEmpty")} />
        ) : (
          <section className="space-y-4">
            {data.items!.map((item) => {
              const key = `${item.requestId}:${item.studentId}`;
              return (
                <article key={key} className="b-card p-4 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold flex-1">{item.title}</h3>
                    <StatusChip status={item.status} t={t} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("consents.forChild")} {item.studentName}{item.className ? ` — ${item.className}` : ""}
                    {item.deadline ? ` · ${t("consents.deadline")}: ${item.deadline}` : ""}
                  </p>
                  <p className="text-sm leading-7 whitespace-pre-line border border-border rounded-lg p-3">{item.body}</p>
                  <input
                    className="b-input w-full"
                    value={notes[key] ?? item.note ?? ""}
                    onChange={(e) => setNotes((s) => ({ ...s, [key]: e.target.value }))}
                    placeholder={t("consents.notePh")}
                  />
                  <div className="flex gap-2">
                    <button className="b-btn b-btn-primary min-h-11 flex-1" disabled={responding === key} onClick={() => respond(item, "APPROVED")}>
                      {responding === key ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("consents.approve")}
                    </button>
                    <button className="b-btn b-btn-ghost min-h-11 flex-1 text-destructive" disabled={responding === key} onClick={() => respond(item, "DECLINED")}>
                      {t("consents.decline")}
                    </button>
                  </div>
                </article>
              );
            })}
          </section>
        )
      )}
    </div>
  );
}
