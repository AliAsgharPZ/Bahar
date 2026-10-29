"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { PLUGIN_HOOKS } from "@/lib/plugins/contract";
import { useLang } from "@/lib/i18n";

type Plugin = { id: string; code: string; name: string; description: string; version: string; homepage: string; manifest: string; status: string };
type Install = { id: string; pluginId: string; status: string; plugin: Plugin };
type PluginsData = { plugins: Plugin[]; installs: Install[] };

export default function PluginsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<PluginsData>("/api/plugins");
  const [busy, setBusy] = useState("");
  const [manifestText, setManifestText] = useState(`{\n  "code": "bahar-report",\n  "name": "${t("plugins.sampleName")}",\n  "version": "1.0.0",\n  "permissions": ["manage_students"],\n  "hooks": ["student.created"]\n}`);
  const [sandboxResult, setSandboxResult] = useState<unknown>(null);

  async function act(action: string, pluginId?: string) {
    setBusy(action + (pluginId ?? ""));
    try { await apiPost("/api/plugins", { action, pluginId }); toast.success(t("plugins.toast.done")); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  async function validateManifest() {
    setBusy("submit");
    try {
      const parsed = JSON.parse(manifestText);
      const res = await apiPost("/api/plugins", { action: "submit", manifest: parsed });
      setSandboxResult(res);
    } catch (err) { toast.error(err instanceof Error ? err.message : t("plugins.toast.invalidManifest")); }
    finally { setBusy(""); }
  }

  const installed = new Map((data?.installs ?? []).map((i) => [i.pluginId, i]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("plugins.title")} desc={t("plugins.desc")} />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">{t("plugins.marketplace")}</b>
            {data.plugins.length === 0 && <span className="text-[12px] text-steel">{t("plugins.marketplace.empty")}</span>}
            {data.plugins.map((p) => {
              const inst = installed.get(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span><b>{p.name}</b><span className="text-steel"> — {p.code} · {t("plugins.version")} {p.version}{p.description ? ` · ${p.description}` : ""}{inst ? <> · {t("plugins.installed")} ({inst.status === "ACTIVE" ? t("common.active") : t("common.inactive")})</> : ""}</span></span>
                  <span className="flex gap-2">
                    {!inst && <button className="b-btn b-btn-spring" disabled={busy === "install" + p.id} onClick={() => act("install", p.id)}>{t("plugins.install")}</button>}
                    {inst && <button className="b-btn b-btn-ghost" disabled={busy === "toggle" + p.id} onClick={() => act("toggle", p.id)}>{inst.status === "ACTIVE" ? t("common.inactive") : t("common.active")}</button>}
                    {inst && <button className="b-btn b-btn-ghost" disabled={busy === "uninstall" + p.id} onClick={() => act("uninstall", p.id)}>{t("plugins.uninstall")}</button>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">{t("plugins.sandbox.title")}</b>
            <p className="text-[12px] text-steel">{t("plugins.sandbox.hooksNote")} {PLUGIN_HOOKS.join("، ")}.</p>
            <textarea className="b-input min-h-40 font-mono text-[12px]" dir="ltr" value={manifestText} onChange={(e) => setManifestText(e.target.value)} />
            <button className="b-btn b-btn-spring self-start" disabled={busy === "submit"} onClick={validateManifest}>{t("plugins.sandbox.validate")}</button>
            {Boolean(sandboxResult) && <pre className="text-[12px] overflow-x-auto whitespace-pre-wrap" dir="ltr">{JSON.stringify(sandboxResult, null, 2)}</pre>}
            <p className="text-[12px] text-steel">{t("plugins.sandbox.contractBefore")} <code dir="ltr">src/lib/plugins/contract.ts</code> {t("plugins.sandbox.contractMid")} <code dir="ltr">/api/mcp</code> {t("plugins.sandbox.contractAfter")}</p>
          </div>
        </>
      )}
    </div>
  );
}
