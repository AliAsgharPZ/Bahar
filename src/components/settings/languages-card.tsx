"use client";
// بهار | مدیریت بسته‌های زبان کاستوم — کارت تنظیمات سوپرادمین
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Languages, Upload, Download, CheckCircle2, XCircle, Trash2, Loader2,
  FileJson, RefreshCcw, ExternalLink, AlertTriangle,
} from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { LanguageBuilder } from "@/components/settings/language-builder";
import { Collapsible } from "@/components/shared/collapsible";
import { useConfirm } from "@/components/shared/pickers";

type PackRow = {
  id: string;
  code: string;
  name: string;
  nativeName: string;
  direction: string;
  status: string;
  author: string | null;
  version: string;
  notes: string | null;
  keyCount: number;
  coverage: number;
  createdAt: string;
  updatedAt: string;
};

type LangResponse = {
  packs: PackRow[];
  selectable?: { code: string; name: string; nativeName: string; direction: string; source: string }[];
  catalogSize: number;
};

export function LanguagesCard({ canCreate = false }: { canCreate?: boolean }) {
  const { data, loading, error, refetch } = useApi<LangResponse>("/api/languages");
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const confirm = useConfirm();
  // راند ۱۸: ساخت بسته با فرم مترجم داخل پنل — بدون JSON
  const [mode, setMode] = useState<"builder" | "upload">("builder");

  async function uploadPack(file: File) {
    setBusy("upload");
    try {
      const text = await file.text();
      if (text.length > 420 * 1024) throw new Error("حجم فایل بیش از حد مجاز است.");
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(text) as Record<string, unknown>;
      } catch {
        throw new Error("فایل JSON نامعتبر است.");
      }
      const res = await apiPost<{ pack?: unknown; warnings?: string[] }>("/api/languages", json);
      toast.success("بسته زبان ذخیره شد (پیش‌نویس).");
      if (res.warnings?.length) toast.warning(res.warnings[0]);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در بارگذاری بسته");
    } finally {
      setBusy(null);
    }
  }

  async function setStatus(pack: PackRow, status: string) {
    setBusy(pack.id);
    try {
      const r = await fetch(`/api/languages/${pack.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || "خطا");
      toast.success(status === "ACTIVE" ? "بسته فعال شد — برای همه کاربران قابل انتخاب است." : "وضعیت بسته تغییر کرد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  async function removePack(pack: PackRow) {
    const ok = await confirm({
      title: `حذف بستهٔ «${pack.nativeName}»`,
      description: "کاربرانِ این زبان به فارسی بازمی‌گردند. این عمل قابل بازگشت نیست.",
      confirmLabel: "حذف",
      danger: true,
    });
    if (!ok) return;
    setBusy(pack.id);
    try {
      const r = await fetch(`/api/languages/${pack.id}`, { method: "DELETE" });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error?.message || "خطا");
      toast.success("بسته حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="b-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2 flex-wrap">
        <b className="text-[13.5px] flex items-center gap-2"><Languages className="w-4 h-4 text-spring" /> زبان‌ها و ترجمه (بسته‌های زبان کاستوم)</b>
        <span className="ms-auto flex items-center gap-2">
          <a href="/langs/template.json" download className="b-btn b-btn-ghost b-btn-sm">
            <Download className="w-3.5 h-3.5" /> تمپلیت
          </a>
          <a href="/languages" target="_blank" rel="noreferrer" className="b-btn b-btn-ghost b-btn-sm">
            <ExternalLink className="w-3.5 h-3.5" /> گایدلاین سایت
          </a>
        </span>
      </div>
      <p className="text-[11.5px] text-steel leading-relaxed">
        زبان جدید را با فرم مترجم زیر بسازید یا فایل JSON بستهٔ آماده را بارگذاری کنید؛ بسته به‌صورت پیش‌نویس ذخیره می‌شود و
        با «فعال‌سازی» برای همه کاربران در انتخاب‌گر زبان (وب/اندروید/ویندوز) ظاهر می‌شود. راهنمای ساخت: صفحه
        «کیت ساخت زبان» در سایت سامانه.
      </p>

      {/* فهرست بسته‌ها — اول بسته‌های همراه سامانه (نه فقط کاستوم‌های پایگاه داده) */}
      {loading && <div className="text-center py-6"><Loader2 className="w-5 h-5 animate-spin inline text-spring" /></div>}
      {error && <div className="b-card-sm !border-destructive/30 bg-destructive/5 text-destructive px-4 py-3 text-[12px]">{error}</div>}
      {data && (data.selectable ?? []).filter((s) => s.source === "shipped").length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px] text-stone px-1">
            <span>{faNumber((data.selectable ?? []).filter((s) => s.source === "shipped").length)} بسته همراه سامانه (فارسی پایه + این‌ها)</span>
          </div>
          {(data.selectable ?? []).filter((s) => s.source === "shipped").map((s) => (
            <div key={s.code} className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-success" />
              <div className="min-w-0 flex-1">
                <b className="text-[12.5px] block truncate">{s.nativeName} <span className="text-steel font-normal">({s.name})</span></b>
                <div className="text-[12px] text-steel flex flex-wrap items-center gap-x-2">
                  <span dir="ltr" className="font-mono">{s.code}</span>
                  <span>·</span>
                  <span>{s.direction === "ltr" ? "چپ‌به‌راست" : "راست‌به‌چپ"}</span>
                  <span>·</span>
                  <span>همراه سامانه</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {data && data.packs.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[12px] text-stone px-1">
            <span>{faNumber(data.packs.length)} بسته ثبت‌شده</span>
            <button onClick={refetch} className="hover:text-spring transition-colors inline-flex items-center gap-1">
              <RefreshCcw className="w-3 h-3" /> به‌روزرسانی
            </button>
          </div>
          {data.packs.map((p) => (
            <div key={p.id} className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${p.status === "ACTIVE" ? "bg-success" : p.status === "DRAFT" ? "bg-warning" : "bg-stone"}`} />
              <div className="min-w-0 flex-1">
                <b className="text-[12.5px] block truncate">
                  {p.nativeName} <span className="text-steel font-normal">({p.name})</span>
                </b>
                <div className="text-[12px] text-steel flex flex-wrap items-center gap-x-2">
                  <span dir="ltr" className="font-mono">{p.code}</span>
                  <span>·</span>
                  <span>{p.direction === "ltr" ? "چپ‌به‌راست" : "راست‌به‌چپ"}</span>
                  <span>·</span>
                  <span>{faNumber(p.keyCount)}/{faNumber(data.catalogSize)} کلید</span>
                  <span>·</span>
                  <span>{faNumber(p.coverage)}٪ پوشش</span>
                  {p.author && <><span>·</span><span>{p.author}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {p.status !== "ACTIVE" ? (
                  <button
                    onClick={() => setStatus(p, "ACTIVE")}
                    disabled={busy === p.id}
                    className="b-btn b-btn-soft b-btn-sm !text-success"
                    title="فعال‌سازی برای همه کاربران"
                  >
                    {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    فعال‌سازی
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus(p, "DISABLED")}
                    disabled={busy === p.id}
                    className="b-btn b-btn-soft b-btn-sm"
                    title="غیرفعال‌سازی — کاربران به فارسی برمی‌گردند"
                  >
                    {busy === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                    غیرفعال
                  </button>
                )}
                <button
                  onClick={() => removePack(p)}
                  disabled={busy === p.id}
                  className="b-btn b-btn-soft b-btn-sm !text-destructive"
                  title="حذف بسته"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {canCreate && <Collapsible title="ساخت زبان جدید">
      {/* راند ۱۸: انتخاب روش — فرم مترجم یا آپلود JSON */}
      <div className="flex items-center gap-1.5">
        <button className={`b-pill-tab ${mode === "builder" ? "b-pill-tab-active" : ""}`} onClick={() => setMode("builder")} aria-pressed={mode === "builder"}>
          ساخت با فرم مترجم
        </button>
        <button className={`b-pill-tab ${mode === "upload" ? "b-pill-tab-active" : ""}`} onClick={() => setMode("upload")} aria-pressed={mode === "upload"}>
          آپلود JSON
        </button>
      </div>

      {mode === "builder" && <LanguageBuilder onCreated={refetch} />}

      {/* بارگذاری */}
      {mode === "upload" && (
      <div className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3 flex-wrap border-dashed">
        <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
          <FileJson className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="text-[12.5px] block">افزودن / جایگزینی بسته زبان</b>
          <span className="text-[12px] text-stone">فایل .json حداکثر ۴۰۰KB — بسته هم‌کد جایگزین می‌شود</span>
        </div>
        <label className="b-btn b-btn-soft b-btn-sm cursor-pointer">
          {busy === "upload" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          انتخاب فایل
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            disabled={busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadPack(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>
      )}

      </Collapsible>}

      <div className="flex items-start gap-2 text-[12px] text-steel leading-5 rounded-xl bg-forest/5 dark:bg-forest/10 p-3">
        <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0 mt-0.5" />
        بسته‌های زبان فقط متن رابط کاربری را عوض می‌کنند؛ داده‌های ثبت‌شده (نام دانش‌آموزان، عنوان درس‌ها و…) به زبان اصلی خودشان می‌مانند.
        تقویم و اعداد فارسی برای همه زبان‌ها فعال است.
      </div>
    </div>
  );
}
