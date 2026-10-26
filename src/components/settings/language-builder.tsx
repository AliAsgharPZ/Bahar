"use client";

/* ============================================================
   بهار | فرم ساخت بستهٔ زبان (راند ۱۸)
   ویرایشگر کلید-به-کلید روی کاتالوگ پایه — مترجم داخل پنل،
   بدون JSON. پوشش ترجمه زنده حساب می‌شود؛ ذخیره به‌صورت DRAFT.
   ============================================================ */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Languages, Loader2, Search, Sparkles } from "lucide-react";
import { apiPost } from "@/lib/client";
import { Select } from "@/components/shared/pickers";
import { CATALOG, CATALOG_KEYS } from "@/lib/langs";

const DIRECTION_OPTIONS = [
  { value: "rtl", label: "راست‌به‌چپ (RTL)" },
  { value: "ltr", label: "چپ‌به‌راست (LTR)" },
];

const GROUPS: Array<{ prefix: string; label: string }> = [
  { prefix: "shell.", label: "پوسته (سربرگ/سایدبار)" },
  { prefix: "nav.", label: "ناوبری" },
  { prefix: "auth.", label: "ورود و احراز هویت" },
  { prefix: "settings.", label: "تنظیمات" },
  { prefix: "common.", label: "عمومی" },
];

function groupOf(key: string): string {
  return GROUPS.find((g) => key.startsWith(g.prefix))?.label ?? "سایر";
}

export function LanguageBuilder({ onCreated }: { onCreated?: () => void }) {
  const [meta, setMeta] = useState({ code: "", name: "", nativeName: "", direction: "rtl", author: "", version: "1.0.0", notes: "" });
  const [strings, setStrings] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const coverage = useMemo(() => {
    const filled = CATALOG_KEYS.filter((k) => strings[k]?.trim()).length;
    return { filled, total: CATALOG_KEYS.length, pct: Math.round((filled / CATALOG_KEYS.length) * 100) };
  }, [strings]);

  const filteredKeys = useMemo(() => {
    const needle = q.trim();
    return CATALOG_KEYS.filter((k) => !needle || k.includes(needle) || CATALOG[k].includes(needle) || (strings[k] ?? "").includes(needle));
  }, [q, strings]);

  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const k of filteredKeys) {
      const g = groupOf(k);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(k);
    }
    return [...map.entries()];
  }, [filteredKeys]);

  async function submit() {
    if (!meta.code.trim() || !meta.name.trim() || !meta.nativeName.trim()) {
      toast.error("کد، نام و نام بومی زبان الزامی است.");
      return;
    }
    if (coverage.filled === 0) {
      toast.error("حداقل چند کلید را ترجمه کنید — پوسته فارسی برای کلیدهای خالی به‌کار می‌رود.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        code: meta.code.trim().toLowerCase(),
        name: meta.name.trim(),
        nativeName: meta.nativeName.trim(),
        direction: meta.direction === "ltr" ? "ltr" : "rtl",
        author: meta.author.trim() || undefined,
        version: meta.version.trim(),
        notes: meta.notes.trim() || undefined,
        strings,
      };
      // اعتبارسنجی خشک
      const dry = await apiPost<{ valid: boolean; errors?: string[]; warnings?: string[] }>("/api/languages?validate=1", payload);
      if (!dry.valid) {
        toast.error(`بسته معتبر نیست — ${(dry.errors ?? []).join(" · ")}`);
        return;
      }
      if ((dry.warnings ?? []).length) toast.warning((dry.warnings ?? []).join(" · "));
      const res = await apiPost<{ pack?: unknown; replaced?: boolean }>("/api/languages", payload);
      toast.success(
        res.replaced
          ? "بستهٔ موجود به‌روزرسانی شد."
          : `بستهٔ زبان «${meta.nativeName}» ساخته شد (پیش‌نویس) — از فهرست بسته‌ها فعالش کنید.`
      );
      setStrings({});
      setMeta({ code: "", name: "", nativeName: "", direction: "rtl", author: "", version: "1.0.0", notes: "" });
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت بستهٔ زبان");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="b-card-sm !rounded-2xl p-4 md:p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-[13.5px] flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-spring" /> ساخت بستهٔ زبان با فرم
        </h3>
        <span className={`b-badge ${coverage.pct >= 80 ? "b-badge-spring" : coverage.pct >= 40 ? "b-badge-warning" : "b-badge-neutral"}`}>
          پوشش ترجمه: {new Intl.NumberFormat("fa-IR").format(coverage.pct)}٪ ({new Intl.NumberFormat("fa-IR").format(coverage.filled)}/{new Intl.NumberFormat("fa-IR").format(coverage.total)})
        </span>
      </div>
      <p className="t-sm text-steel leading-relaxed">
        رابط کاربری برای ساخت زبان/لهجهٔ جدید داخل خود سایت — مترجم فارسی پایه کنار هر کلید است؛ کلیدهای خالی به فارسی نمایش داده می‌شوند. تقویم و قواعد کشور جداگانه از تب «کشور» ساخته می‌شود.
      </p>

      {/* ── مشخصات بسته ── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">کد زبان * (مثل en)</span>
          <input className="b-input !h-10" dir="ltr" placeholder="en" value={meta.code} onChange={(e) => setMeta({ ...meta, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 12) })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">نام (فارسی) *</span>
          <input className="b-input !h-10" placeholder="انگلیسی" value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">نام بومی *</span>
          <input className="b-input !h-10" placeholder="English" value={meta.nativeName} onChange={(e) => setMeta({ ...meta, nativeName: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">جهت متن</span>
          <Select value={meta.direction} onChange={(v) => setMeta({ ...meta, direction: v })} options={DIRECTION_OPTIONS} buttonClassName="!h-10" className="w-full" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">نسخه</span>
          <input className="b-input !h-10" dir="ltr" placeholder="1.0.0" value={meta.version} onChange={(e) => setMeta({ ...meta, version: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[11.5px] font-bold">پدیدگار (اختیاری)</span>
          <input className="b-input !h-10" placeholder="نام شما" value={meta.author} onChange={(e) => setMeta({ ...meta, author: e.target.value })} />
        </label>
      </div>

      {/* ── جستجو ── */}
      <div className="flex items-center gap-2 b-input !rounded-full !h-10 !px-4">
        <Search className="w-4 h-4 text-stone shrink-0" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="جستجوی کلید یا متن فارسی…"
          className="flex-1 bg-transparent outline-none text-[13px] min-w-0"
        />
        {q && <button onClick={() => setQ("")} className="text-stone hover:text-foreground text-[16px] leading-none" aria-label="پاک‌کردن">×</button>}
      </div>

      {/* ── ویرایشگر کلیدها ── */}
      <div className="max-h-[420px] overflow-y-auto b-scroll rounded-2xl border border-hairline-soft flex flex-col gap-4 p-3.5">
        {grouped.map(([group, keys]) => (
          <div key={group}>
            <h4 className="text-[11px] font-bold text-spring-deep mb-2 sticky top-0 bg-card/95 backdrop-blur py-1 z-[1]">
              {group} <span className="text-stone font-normal">({new Intl.NumberFormat("fa-IR").format(keys.length)})</span>
            </h4>
            <div className="flex flex-col gap-2">
              {keys.map((k) => (
                <div key={k} className="grid sm:grid-cols-[1.1fr_1fr] gap-2 items-start">
                  <div className="flex flex-col min-w-0">
                    <code className="text-[10px] text-stone truncate" dir="ltr">{k}</code>
                    <span className="text-[12px] text-steel leading-snug">{CATALOG[k]}</span>
                  </div>
                  <input
                    className="b-input !h-9 !text-[12px]"
                    placeholder="ترجمه…"
                    dir={meta.direction === "ltr" ? "ltr" : "rtl"}
                    value={strings[k] ?? ""}
                    onChange={(e) => setStrings((s) => ({ ...s, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        {grouped.length === 0 && <p className="text-[12px] text-steel text-center py-6">کلیدی مطابق جستجو نیست.</p>}
      </div>

      <div className="flex items-center gap-2">
        <button className="b-btn b-btn-spring" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
          ساخت و ذخیرهٔ بستهٔ زبان
        </button>
        <span className="text-[11px] text-steel">ذخیره به‌صورت پیش‌نویس — فعال‌سازی از فهرست بسته‌ها.</span>
      </div>
    </div>
  );
}
