"use client";
// بهار | مدیریت بسته‌های کشور کاستوم — کارت تنظیمات سوپرادمین (راند ۱۶)
// بارگذاری JSON پروفایل کشور + اعتبارسنجی خشک + فعال‌سازی/غیرفعال‌سازی
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Globe2, Upload, CheckCircle2, XCircle, Trash2, Loader2,
  FileJson, RefreshCcw, ExternalLink, AlertTriangle, Map,
} from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { CountryBuilder } from "@/components/settings/country-builder";
import { Collapsible } from "@/components/shared/collapsible";

type PackRow = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  status: string;
  version: string;
  notes: string | null;
  createdAt: string;
};

type CountryResponse = {
  packs: PackRow[];
  active: string;
};

type Validation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: { regions: number; counties: number; workDays: number; gradeLevels: number; hasMap: boolean; mapProvinces: number; bytes: number };
};

export function CountryCard() {
  const { data, loading, error, refetch } = useApi<CountryResponse>("/api/countries");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState<Validation | null>(null);
  // راند ۱۸: ساخت بسته با فرم — بدون JSON
  const [mode, setMode] = useState<"upload" | "builder">("builder");

  async function uploadPack(file: File) {
    setBusy("upload");
    setDryRun(null);
    try {
      const text = await file.text();
      if (text.length > 620 * 1024) throw new Error("حجم فایل بیش از حد مجاز (۶۰۰KB) است.");
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("فایل JSON نامعتبر است.");
      }
      // اعتبارسنجی خشک
      const dry = await apiPost<{ validation: Validation }>("/api/countries?validate=1", json);
      setDryRun(dry.validation);
      if (!dry.validation.ok) {
        toast.error(`بسته رد شد — ${dry.validation.errors.length} خطا (زیر ببینید)`);
        return;
      }
      // ذخیره واقعی
      await apiPost("/api/countries", json);
      toast.success("بسته کشور ذخیره شد (پیش‌نویس) — از جدول فعالش کنید.");
      if (dry.validation.warnings.length) toast.warning(dry.validation.warnings[0]);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در بارگذاری بسته");
    } finally {
      setBusy(null);
    }
  }

  async function action(pack: PackRow, act: "activate" | "disable" | "delete") {
    if (act === "activate") {
      if (!confirm(`پروفایل کشور «${pack.name}» فعال شود؟ تقویم/کد ملی/مناطق/ارز کل سامانه عوض می‌شود. (ایران با غیرفعال‌کردن برمی‌گردد)`)) return;
    }
    if (act === "delete" && !confirm(`بسته «${pack.name}» حذف شود؟`)) return;
    setBusy(pack.id);
    try {
      const r = await fetch(`/api/countries/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: act }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || "خطا");
      toast.success(
        act === "activate" ? "پروفایل کشور فعال شد — تقویم و قواعد جدید اعمال می‌شود."
        : act === "disable" ? "بسته غیرفعال شد — دیفالت ایران فعال است."
        : "بسته حذف شد — دیفالت ایران فعال است.",
      );
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="b-card-md p-5 md:p-6">
      <h3 className="font-bold text-[15px] mb-2 flex items-center gap-2">
        <Globe2 className="w-5 h-5 text-spring" /> کشور و بومی‌سازی
      </h3>
      <p className="t-sm text-steel mb-4">
        پروفایل کشور فعال، تقویم (شمسی/میلادی/قمری/…)، قواعد کد ملی و موبایل، مناطق (استان/شهرستان)، واحد پول،
        پایه‌های تحصیلی و هفته کاری را تعیین می‌کند. دیفالت: <b>ایران</b>.
        قالب و راهنمای کامل ساخت بسته: <a href="/countries" target="_blank" className="text-spring font-bold hover:underline">کیت کشور بهار</a>
      </p>

      {loading && <p className="t-sm text-steel">در حال بارگذاری…</p>}
      {error && <p className="t-sm text-destructive">بارگذاری ناموفق بود.</p>}

      {/* جدول بسته‌ها */}
      {data && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[11px] text-stone">
            <span className={`b-badge ${data.active === "IR" ? "b-badge-success" : "b-badge-neutral"}`}>ایران — پیش‌فرض داخلی</span>
            <span>تقویم شمسی · کد ملی mod-11 · ۳۱ استان · تومان</span>
          </div>
          {data.packs.map((p) => (
            <div key={p.id} className="b-card-sm !rounded-xl p-3.5 flex flex-wrap items-center gap-3">
              <div className="flex flex-col min-w-0">
                <b className="text-[12.5px]">{p.name} <span className="text-stone font-mono text-[10.5px]">({p.code})</span></b>
                <span className="text-[10.5px] text-steel">{p.nativeName} · نسخه {p.version}{p.notes ? ` · ${p.notes}` : ""}</span>
              </div>
              <span className={`b-badge ms-auto ${p.status === "ACTIVE" ? "b-badge-success" : p.status === "DISABLED" ? "b-badge-neutral" : "b-badge-warning"}`}>
                {p.status === "ACTIVE" ? "فعال" : p.status === "DISABLED" ? "غیرفعال" : "پیش‌نویس"}
              </span>
              <div className="flex gap-1.5">
                {p.status !== "ACTIVE" && (
                  <button className="b-btn b-btn-spring b-btn-sm !min-h-[30px]" onClick={() => action(p, "activate")} disabled={busy === p.id}>
                    {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} فعال‌سازی
                  </button>
                )}
                {p.status === "ACTIVE" && (
                  <button className="b-btn b-btn-soft b-btn-sm !min-h-[30px]" onClick={() => action(p, "disable")} disabled={busy === p.id}>
                    <RefreshCcw className="w-3.5 h-3.5" /> بازگشت به ایران
                  </button>
                )}
                <button className="b-btn b-btn-ghost b-btn-sm !min-h-[30px] !text-destructive" onClick={() => action(p, "delete")} disabled={busy === p.id}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
          {data.packs.length === 0 && (
            <p className="t-cap text-stone">هنوز بسته کشور کاستومی بارگذاری نشده — دیفالت ایران فعال است.</p>
          )}
        </div>
      )}
      <Collapsible title="ساخت کشور جدید">
      {/* راند ۱۸: انتخاب روش — فرم یا آپلود JSON */}
      <div className="flex items-center gap-1.5 mb-4">
        <button className={`b-pill-tab ${mode === "builder" ? "b-pill-tab-active" : ""}`} onClick={() => setMode("builder")} aria-pressed={mode === "builder"}>
          ساخت با فرم
        </button>
        <button className={`b-pill-tab ${mode === "upload" ? "b-pill-tab-active" : ""}`} onClick={() => setMode("upload")} aria-pressed={mode === "upload"}>
          آپلود JSON
        </button>
      </div>

      {mode === "builder" && <CountryBuilder onCreated={refetch} />}

      {/* آپلود */}
      {mode === "upload" && (
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPack(f); e.target.value = ""; }}
        />
        <button className="b-btn b-btn-spring b-btn-sm" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
          {busy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} بارگذاری بسته کشور (JSON)
        </button>
        <a href="/countries/template.json" download className="b-btn b-btn-soft b-btn-sm">
          <FileJson className="w-4 h-4" /> دانلود قالب (نسخه ایران)
        </a>
        <a href="/countries" target="_blank" className="b-btn b-btn-ghost b-btn-sm">
          <ExternalLink className="w-4 h-4" /> راهنمای ساخت
        </a>
        <span className="ms-auto flex items-center gap-1.5 text-[12px]">
          فعال: <b className={data && data.active !== "IR" ? "text-spring" : "text-steel"}>{data?.active === "IR" ? "ایران (دیفالت)" : data?.active ?? "—"}</b>
        </span>
      </div>
      )}

      {/* نتیجه اعتبارسنجی */}
      {dryRun && (
        <div className={`b-card-sm !rounded-2xl p-4 mb-4 ${dryRun.ok ? "!border-spring/40 bg-spring-tint/30" : "!border-destructive/40 bg-destructive/5"}`}>
          <b className="block text-[13px] mb-2 flex items-center gap-2">
            {dryRun.ok ? <CheckCircle2 className="w-4 h-4 text-spring" /> : <XCircle className="w-4 h-4 text-destructive" />}
            {dryRun.ok ? "اعتبارسنجی موفق" : `اعتبارسنجی ناموفق (${dryRun.errors.length} خطا)`}
          </b>
          {dryRun.errors.length > 0 && (
            <ul className="text-[11.5px] text-destructive leading-relaxed list-disc ps-5 mb-2">
              {dryRun.errors.slice(0, 12).map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          )}
          {dryRun.warnings.length > 0 && (
            <ul className="text-[11.5px] text-warning-deep leading-relaxed list-disc ps-5 mb-2">
              {dryRun.warnings.slice(0, 6).map((w, i) => <li key={i}><AlertTriangle className="w-3 h-3 inline" /> {w}</li>)}
            </ul>
          )}
          <div className="flex flex-wrap gap-2 text-[11px] text-steel mt-1">
            <span className="b-badge b-badge-neutral">استان‌ها: {faNumber(dryRun.stats.regions)}</span>
            <span className="b-badge b-badge-neutral">شهرستان‌ها: {faNumber(dryRun.stats.counties)}</span>
            <span className="b-badge b-badge-neutral">روزهای کاری: {faNumber(dryRun.stats.workDays)}</span>
            <span className="b-badge b-badge-neutral">پایه‌ها: {faNumber(dryRun.stats.gradeLevels)}</span>
            <span className="b-badge b-badge-neutral">حجم: {faNumber(Math.round(dryRun.stats.bytes / 1024))}KB</span>
            {dryRun.stats.hasMap && <span className="b-badge b-badge-success"><Map className="w-3 h-3 inline" /> نقشه: {faNumber(dryRun.stats.mapProvinces)} استان</span>}
          </div>
        </div>
      )}

      </Collapsible>
    </div>
  );
}
