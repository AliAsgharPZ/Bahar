"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bot, Loader2, Plus, Trash2, RefreshCw, Link2, Unlink, ExternalLink } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Platform = { id: string; name: string; style: string; inbound: boolean; miniApp: boolean; hint: string; needsApiBase: boolean };
type Conn = {
  id: string; platform: string; platformName: string; style: string; inbound: boolean; miniApp: boolean;
  label: string; tokenMasked: string; apiBase: string | null; botUsername: string | null;
  events: string; isActive: boolean; linksCount: number;
};
type Available = { id: string; platform: string; platformName: string; label: string; botUsername: string | null; style: string; inbound: boolean };
type MyLink = {
  id: string; connectionId: string; platform: string; label: string; botUsername: string | null;
  chatId: string | null; username: string | null; pending: boolean; linkCode: string | null; isActive: boolean;
};
type Data = { isStaff: boolean; available: Available[]; platforms: Platform[]; connections: Conn[]; myLinks: MyLink[] };

export default function BotsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<Data>("/api/bots");
  const [platform, setPlatform] = useState("TELEGRAM");
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [events, setEvents] = useState("ALL");
  const [busy, setBusy] = useState(false);
  const [codeBusy, setCodeBusy] = useState<string | null>(null);
  const [freshCode, setFreshCode] = useState<{ connectionId: string; code: string; deepLink: string | null } | null>(null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const selectedPlatform = data.platforms.find((p) => p.id === platform);
  const linkable: Available[] = data.isStaff
    ? data.connections.filter((c) => c.isActive).map((c) => ({ id: c.id, platform: c.platform, platformName: c.platformName, label: c.label, botUsername: c.botUsername, style: c.style, inbound: c.inbound }))
    : data.available;

  const create = async () => {
    if (!token.trim()) { toast.error(t("bots.token")); return; }
    setBusy(true);
    try {
      const res = await apiPost<{ webhookOk: boolean | null }>("/api/bots", { platform, label, token, apiBase: apiBase || undefined, events });
      setToken(""); setLabel(""); setApiBase("");
      if (res.webhookOk === false) toast.warning(t("bots.webhookWarn"));
      else toast.success(t("bots.createdToast"));
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally { setBusy(false); }
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await apiPatch<{ webhookOk: boolean | null }>("/api/bots", { id, ...body });
      if (body.rewebhook && res.webhookOk === false) toast.warning(t("bots.webhookWarn"));
      refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("bots.deleteConfirm"))) return;
    try { await apiDelete(`/api/bots?id=${id}`); toast.success(t("bots.deletedToast")); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const getCode = async (connectionId: string) => {
    setCodeBusy(connectionId);
    try {
      const res = await apiPost<{ linked: boolean; code?: string; deepLink?: string | null }>("/api/bots/link", { connectionId });
      if (res.linked) { toast.success(t("bots.linkedAs")); refetch(); }
      else if (res.code) setFreshCode({ connectionId, code: res.code, deepLink: res.deepLink ?? null });
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
    finally { setCodeBusy(null); }
  };

  const unlink = async (id: string) => {
    try { await apiDelete(`/api/bots/link?id=${id}`); toast.success(t("bots.unlinkedToast")); setFreshCode(null); refetch(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  const myLinkFor = (connectionId: string) => data.myLinks.find((l) => l.connectionId === connectionId);

  return (
    <div className="space-y-6">
      <PageHeader title={t("bots.title")} desc={t("bots.desc")} />

      {data.isStaff && (
        <section className="b-card p-4 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Plus className="w-5 h-5" /> {t("bots.addTitle")}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">{t("bots.platform")}</span>
              <select className="b-input w-full" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {data.platforms.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">{t("bots.label")}</span>
              <input className="b-input w-full" value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("bots.labelPh")} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">{t("bots.token")}</span>
              <input className="b-input w-full" dir="ltr" type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder={t("bots.tokenPh")} />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-muted-foreground">{t("bots.events")}</span>
              <select className="b-input w-full" value={events} onChange={(e) => setEvents(e.target.value)}>
                <option value="ALL">{t("bots.events.ALL")}</option>
                <option value="IMPORTANT">{t("bots.events.IMPORTANT")}</option>
                <option value="NONE">{t("bots.events.NONE")}</option>
              </select>
            </label>
            {selectedPlatform?.needsApiBase && (
              <label className="block space-y-1 md:col-span-2">
                <span className="text-sm text-muted-foreground">{t("bots.apiBase")}</span>
                <input className="b-input w-full" dir="ltr" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://…" />
              </label>
            )}
          </div>
          {selectedPlatform && <p className="text-sm text-muted-foreground">{selectedPlatform.hint}</p>}
          <button className="b-btn b-btn-primary min-h-11" disabled={busy} onClick={create}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("bots.create")}
          </button>

          {data.connections.length === 0 ? (
            <EmptyState title={t("bots.empty")} />
          ) : (
            <ul className="divide-y divide-border">
              {data.connections.map((c) => (
                <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.platformName} — {c.label} {c.botUsername && <span dir="ltr" className="text-muted-foreground">@{c.botUsername}</span>}</p>
                    <p className="text-sm text-muted-foreground">
                      <span dir="ltr">{c.tokenMasked}</span> · {faNumber(c.linksCount)} {t("bots.linksCount")} · {c.isActive ? t("bots.active") : t("bots.inactive")}
                    </p>
                  </div>
                  <select className="b-input" value={c.events} onChange={(e) => patch(c.id, { events: e.target.value })} aria-label={t("bots.events")}>
                    <option value="ALL">{t("bots.events.ALL")}</option>
                    <option value="IMPORTANT">{t("bots.events.IMPORTANT")}</option>
                    <option value="NONE">{t("bots.events.NONE")}</option>
                  </select>
                  <button className="b-btn b-btn-ghost min-h-11" onClick={() => patch(c.id, { isActive: !c.isActive })}>{c.isActive ? t("bots.inactive") : t("bots.active")}</button>
                  {c.inbound && <button className="b-btn b-btn-ghost min-h-11" onClick={() => patch(c.id, { rewebhook: true })}><RefreshCw className="w-4 h-4" /> {t("bots.rewebhook")}</button>}
                  <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /> {t("bots.delete")}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="b-card p-4 space-y-4">
        <h2 className="font-bold flex items-center gap-2"><Link2 className="w-5 h-5" /> {t("bots.myTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("bots.myDesc")}</p>
        {linkable.length === 0 ? (
          <EmptyState title={t("bots.noConnections")} />
        ) : (
          <ul className="divide-y divide-border">
            {linkable.map((c) => {
              const link = myLinkFor(c.id);
              return (
                <li key={c.id} className="py-3 flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{c.platformName} — {c.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {!c.inbound && c.style !== "whatsapp"
                        ? t("bots.sendOnly")
                        : link?.chatId
                          ? `${t("bots.linkedAs")}${link.username ? ` — @${link.username}` : ""}`
                          : link
                            ? t("bots.pending")
                            : ""}
                    </p>
                    {freshCode?.connectionId === c.id && (
                      <p className="text-sm mt-1">
                        {t("bots.codeReady")} <code dir="ltr" className="font-bold">{freshCode.code}</code>
                        {freshCode.deepLink && (
                          <> · <a className="text-primary underline" href={freshCode.deepLink} target="_blank" rel="noreferrer">{t("bots.openBot")} <ExternalLink className="inline w-3.5 h-3.5" /></a></>
                        )}
                      </p>
                    )}
                  </div>
                  {link?.chatId ? (
                    <button className="b-btn b-btn-ghost min-h-11 text-destructive" onClick={() => unlink(link.id)}><Unlink className="w-4 h-4" /> {t("bots.unlink")}</button>
                  ) : (
                    <button className="b-btn b-btn-primary min-h-11" disabled={codeBusy === c.id} onClick={() => getCode(c.id)}>
                      {codeBusy === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />} {t("bots.getCode")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
