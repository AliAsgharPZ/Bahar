"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { PLUGIN_HOOKS } from "@/lib/plugins/contract";

type Plugin = { id: string; code: string; name: string; description: string; version: string; homepage: string; manifest: string; status: string };
type Install = { id: string; pluginId: string; status: string; plugin: Plugin };
type PluginsData = { plugins: Plugin[]; installs: Install[] };

export default function PluginsPage() {
  const { data, loading, error, refetch } = useApi<PluginsData>("/api/plugins");
  const [busy, setBusy] = useState("");
  const [manifestText, setManifestText] = useState(`{\n  "code": "bahar-report",\n  "name": "گزارش‌ساز نمونه",\n  "version": "1.0.0",\n  "permissions": ["manage_students"],\n  "hooks": ["student.created"]\n}`);
  const [sandboxResult, setSandboxResult] = useState<unknown>(null);

  async function act(action: string, pluginId?: string) {
    setBusy(action + (pluginId ?? ""));
    try { await apiPost("/api/plugins", { action, pluginId }); toast.success("انجام شد."); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function validateManifest() {
    setBusy("submit");
    try {
      const parsed = JSON.parse(manifestText);
      const res = await apiPost("/api/plugins", { action: "submit", manifest: parsed });
      setSandboxResult(res);
    } catch (err) { toast.error(err instanceof Error ? err.message : "مانیفست JSON نامعتبر است"); }
    finally { setBusy(""); }
  }

  const installed = new Map((data?.installs ?? []).map((i) => [i.pluginId, i]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="بازارچهٔ افزونه‌ها" desc="کاتالوگ افزونه، نصب برای مدرسه و سندباکس توسعه‌دهنده — بدون اجرای کد دلخواه در اپ." />
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && (
        <>
          <div className="b-card p-6 flex flex-col gap-1">
            <b className="text-[14px] mb-2">بازارچه</b>
            {data.plugins.length === 0 && <span className="text-[12.5px] text-steel">هنوز افزونه‌ای منتشر نشده است. انتشار فقط با سوپرادمین است.</span>}
            {data.plugins.map((p) => {
              const inst = installed.get(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span><b>{p.name}</b><span className="text-steel"> — {p.code} · نسخهٔ {p.version}{p.description ? ` · ${p.description}` : ""}{inst ? ` · نصب‌شده (${inst.status === "ACTIVE" ? "فعال" : "غیرفعال"})` : ""}</span></span>
                  <span className="flex gap-2">
                    {!inst && <button className="b-btn b-btn-spring" disabled={busy === "install" + p.id} onClick={() => act("install", p.id)}>نصب</button>}
                    {inst && <button className="b-btn b-btn-ghost" disabled={busy === "toggle" + p.id} onClick={() => act("toggle", p.id)}>{inst.status === "ACTIVE" ? "غیرفعال" : "فعال"}</button>}
                    {inst && <button className="b-btn b-btn-ghost" disabled={busy === "uninstall" + p.id} onClick={() => act("uninstall", p.id)}>حذف نصب</button>}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="b-card p-6 flex flex-col gap-3">
            <b className="text-[14px]">سندباکس توسعه‌دهنده: اعتبارسنجی مانیفست</b>
            <p className="text-[12.5px] text-steel">مانیفست را اینجا اعتبارسنجی کنید؛ کد افزونه در اپ اجرا نمی‌شود و نصب، مجوزی بیش از مدرسه نمی‌دهد. هوک‌های مجاز: {PLUGIN_HOOKS.join("، ")}.</p>
            <textarea className="b-input min-h-40 font-mono text-[12px]" dir="ltr" value={manifestText} onChange={(e) => setManifestText(e.target.value)} />
            <button className="b-btn b-btn-spring self-start" disabled={busy === "submit"} onClick={validateManifest}>اعتبارسنجی</button>
            {Boolean(sandboxResult) && <pre className="text-[12px] overflow-x-auto whitespace-pre-wrap" dir="ltr">{JSON.stringify(sandboxResult, null, 2)}</pre>}
            <p className="text-[12.5px] text-steel">قرارداد کامل در <code dir="ltr">src/lib/plugins/contract.ts</code> منتشر شده است؛ سطح API ایجنت‌ها هم سرور MCP در <code dir="ltr">/api/mcp</code> است.</p>
          </div>
        </>
      )}
    </div>
  );
}
