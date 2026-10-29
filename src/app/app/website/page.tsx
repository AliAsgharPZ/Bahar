"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Globe, Loader2, Upload, Eye, Rocket, Palette, Type, Layers, MapPin, Trash2, Plus,
  ExternalLink, Lock, Shuffle, RotateCcw,
} from "lucide-react";
import { useApi, apiPut } from "@/lib/client";
import { slugify } from "@/lib/persian";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { SITE_TEMPLATES, templateOf, unifiedTemplateId, SECTION_LABELS, type SiteSectionKey } from "@/lib/school-site";
import type { SiteConfig } from "@/components/school-site/templates";

type SiteResponse = {
  site: {
    subdomain: string;
    templateId: string;
    published: boolean;
    views: number;
    config: SiteConfig;
    templates: typeof SITE_TEMPLATES;
    school: { id: string; name: string; motto: string | null; about: string | null; phone: string | null; address: string | null; logoUrl: string | null };
  };
};

type Me = { user: { role: string; school: { name: string } | null; actingSchool: { name: string } | null } };

export default function WebsiteEditorPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const { data, loading, error, refetch } = useApi<SiteResponse>("/api/school-site");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"template" | "content" | "sections" | "domain">("template");
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [templateId, setTemplateId] = useState<string>("");
  const [subdomain, setSubdomain] = useState<string>("");
  const [published, setPublished] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string>("");

  if (loading) return <LoadingBlock label="بارگذاری ویرایشگر سایت…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  // همگام‌سازی وضعیت اولیه
  if (config === null) {
    setConfig(data.site.config);
    setTemplateId(data.site.templateId);
    setSubdomain(data.site.subdomain);
    setPublished(data.site.published);
  }

  const site = data.site;
  const templates = SITE_TEMPLATES;
  // تمپلیت فعلی با شناسهٔ قدیمی هم درست حل می‌شود (پالت‌های اصلی همان شناسه)
  const currentTemplate = templateOf(templateId);
  // پالت نهایی: رنگ دلخواه بر پالت پیشنهادی اولویت دارد
  const resolvedPalette = config?.customPalette
    ?? currentTemplate.palettes[Math.min(config?.palette ?? 0, currentTemplate.palettes.length - 1)];

  function patchConfig(patch: Partial<SiteConfig>) {
    setConfig((c) => (c ? { ...c, ...patch } : c));
  }

  function toggleSection(key: SiteSectionKey) {
    setConfig((c) => {
      if (!c) return c;
      return { ...c, sections: { ...c.sections, [key]: !c.sections[key] } };
    });
  }

  async function save(publish?: boolean): Promise<boolean> {
    setSaving(true);
    try {
      // FIX (راند ۱۸): پاسخ شامل subdomain اسلاگ‌شدهٔ سمت سرور است —
      // کلاینت باید لینک‌ها را از مقدار واقعی بسازد نه ورودی خام کاربر
      const res = await apiPut<{ ok?: boolean; subdomain?: string; published?: boolean }>("/api/school-site", {
        templateId,
        subdomain,
        published: publish ?? published,
        config,
      });
      if (typeof res?.subdomain === "string" && res.subdomain) setSubdomain(res.subdomain);
      if (publish !== undefined) setPublished(publish);
      toast.success(publish === true ? "سایت مدرسه منتشر شد!" : "تغییرات ذخیره شد.");
      refetch();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function uploadImage(field: string, file: File) {
    setUploading(field);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا در آپلود");
      if (field === "gallery") {
        patchConfig({ gallery: [...(config?.gallery ?? []), json.url] });
      } else {
        patchConfig({ [field]: json.url } as Partial<SiteConfig>);
      }
      toast.success("تصویر بارگذاری شد — برای اعمال، ذخیره کنید.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function pickFile(field: string) {
    setUploadTarget(field);
    fileRef.current?.click();
  }

  // FIX (راند ۱۸): آدرس مشاهده از اسلاگِ واقعی ساخته می‌شود —
  // ورودی فارسی/بزرگ کاربر سمت سرور ترجمیه می‌شود و قبلاً لینک ۴۰۴ می‌داد
  const effectiveSlug = slugify(subdomain) || site.subdomain;

  const ImageField = ({ field, label, hint }: { field: string; label: string; hint?: string }) => (
    <div className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3">
      {(() => {
        const url = (config as unknown as Record<string, string>)?.[field];
        return url ? (
          <img src={url} alt={label} className="w-14 h-14 rounded-xl object-cover border border-hairline shrink-0" />
        ) : (
          <span className="w-14 h-14 rounded-xl bg-cloud flex items-center justify-center text-stone shrink-0">
            <Upload className="w-5 h-5" />
          </span>
        );
      })()}
      <div className="min-w-0 flex-1">
        <b className="text-[12.5px] block">{label}</b>
        {hint && <span className="text-[10.5px] text-steel block truncate">{hint}</span>}
      </div>
      <button type="button" className="b-btn b-btn-soft b-btn-sm shrink-0" onClick={() => pickFile(field)} disabled={uploading === field}>
        {uploading === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
        آپلود
      </button>
    </div>
  );

  const tabs = [
    { id: "template", label: "تمپلیت و رنگ", icon: Palette },
    { id: "content", label: "متن‌ها و تصاویر", icon: Type },
    { id: "sections", label: "بخش‌ها", icon: Layers },
    { id: "domain", label: "انتشار و آدرس", icon: Globe },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سایت مدرسه"
        desc="تمپلیت آماده را انتخاب کنید، متن‌ها و تصاویر را شخصی‌سازی کنید و سایت اختصاصی مدرسه را منتشر کنید. ساختار قفل است — فقط محتوا تغییر می‌کند."
        action={
          <div className="flex items-center gap-2">
            {/* پیش‌نمایش = اول ذخیرهٔ پیش‌نویس، بعد باز کردن؛ وگرنه پیش‌نمایش
                حالتِ ذخیره‌شدهٔ قبلی را نشان می‌داد نه انتخاب‌های فعلی ویرایشگر */}
            <button
              type="button"
              className="b-btn b-btn-soft b-btn-sm"
              disabled={saving || !config}
              onClick={async () => {
                const ok = await save();
                if (ok) window.open(`/s/${slugify(subdomain) || site.subdomain}?preview=1`, "_blank");
              }}
            >
              <Eye className="w-4 h-4" /> پیش‌نمایش
            </button>
            {site.published && (
              <a href={`/s/${effectiveSlug}`} target="_blank" rel="noreferrer" className="b-btn b-btn-soft b-btn-sm">
                <ExternalLink className="w-4 h-4" /> مشاهده سایت
              </a>
            )}
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => save()} disabled={saving || !config}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
            </button>
          </div>
        }
      />

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f && uploadTarget) uploadImage(uploadTarget, f);
        }}
      />

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.id} className={`b-pill-tab ${tab === t.id ? "b-pill-tab-active" : ""}`} onClick={() => setTab(t.id)}>
            <t.icon className="w-3.5 h-3.5 inline ml-1" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ───── تمپلیت و رنگ ───── */}
      {tab === "template" && (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((t) => {
            const active = templateId === t.id || unifiedTemplateId(templateId) === t.id;
            return (
              <button
                key={t.id}
                onClick={() => { setTemplateId(t.id); setConfig((c) => (c ? { ...c, palette: 0, customPalette: null } : c)); }}
                className={`b-btn b-btn-ghost b-card p-5 text-right transition-all ${active ? "!border-spring ring-2 ring-spring/25" : "hover:border-spring/40"}`}
              >
                <div
                  className="h-28 rounded-2xl mb-4 relative overflow-hidden"
                  style={{
                    background: t.id === "modern" || t.id === "royal"
                      ? `linear-gradient(135deg, ${t.palettes[0].bg}, ${t.palettes[0].primary}55)`
                      : t.palettes[0].bg,
                  }}
                >
                  <div className="absolute bottom-3 right-3 flex gap-1.5">
                    <span className="w-8 h-2 rounded-full" style={{ background: t.palettes[0].primary }} />
                    <span className="w-4 h-2 rounded-full" style={{ background: t.palettes[0].accent }} />
                  </div>
                  {t.id === "playful" && <span className="absolute top-3 left-3 w-6 h-6 rounded-full opacity-60" style={{ background: t.palettes[0].accent }} />}
                  {t.id === "academic" && <span className="absolute top-3 right-3 text-white text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: t.palettes[0].primary }}>پایه</span>}
                </div>
                <b className="text-[14px] block mb-1">{t.name} {active && <span className="b-badge b-badge-spring !text-[9px] ms-1">فعال</span>}</b>
                <p className="text-[11.5px] text-steel leading-relaxed mb-3">{t.desc}</p>
                <div className="flex gap-2 flex-wrap">
                  {t.palettes.map((pal, pi) => (
                    <span
                      key={pi}
                      className={`flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full border ${config?.palette === pi && templateId === t.id && !config?.customPalette ? "border-spring font-bold" : "border-hairline"}`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ background: pal.primary }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: pal.accent }} />
                      {pal.label}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}

          <div className="b-card p-5 md:col-span-2 xl:col-span-3 flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13.5px]">رنگ‌بندی تمپلیت «{currentTemplate.name}»</b>
              <span className="text-[11px] text-steel">({currentTemplate.palettes.length} پالت پیشنهادی)</span>
              <button
                type="button"
                className="b-btn b-btn-soft b-btn-sm ms-auto"
                disabled={!config || currentTemplate.palettes.length < 2}
                onClick={() => {
                  if (!config) return;
                  const others = currentTemplate.palettes
                    .map((_, i) => i)
                    .filter((i) => i !== config.palette || config.customPalette);
                  const pick = others[Math.floor(Math.random() * others.length)];
                  patchConfig({ palette: pick, customPalette: null });
                }}
              >
                <Shuffle className="w-3.5 h-3.5" /> پالت تصادفی
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              {currentTemplate.palettes.map((pal, pi) => (
                <button
                  key={pi}
                  onClick={() => patchConfig({ palette: pi, customPalette: null })}
                  className={`b-btn b-btn-ghost b-option !py-2.5 !px-4 ${config?.palette === pi && !config?.customPalette ? "b-option-selected" : ""}`}
                >
                  <span className="w-5 h-5 rounded-full" style={{ background: pal.primary }} />
                  <span className="w-4 h-4 rounded-full" style={{ background: pal.accent }} />
                  <b className="text-[12px]">{pal.label}</b>
                </button>
              ))}
            </div>

            {/* رنگ دلخواه — انتخاب با پیکر رنگ یا ورودی هگز؛ در پیش‌نمایش و سایت ذخیره‌شده یکسان اعمال می‌شود */}
            <div className="b-card-sm !rounded-xl p-4 flex flex-col gap-3" key={`${templateId}-${resolvedPalette.primary}-${resolvedPalette.accent}-${resolvedPalette.bg}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <b className="text-[12.5px]">رنگ دلخواه</b>
                <span className="text-[11px] text-steel">با پیکر رنگ یا کد هگز، سه رنگ اصلی/لهجه/پس‌زمینه را خودتان بسازید</span>
                {config?.customPalette && (
                  <button type="button" className="b-btn b-btn-ghost b-btn-sm ms-auto" onClick={() => patchConfig({ customPalette: null })}>
                    <RotateCcw className="w-3.5 h-3.5" /> بازگشت به پالت پیشنهادی
                  </button>
                )}
              </div>
              {([
                { key: "primary" as const, label: "رنگ اصلی", value: resolvedPalette.primary },
                { key: "accent" as const, label: "رنگ لهجه", value: resolvedPalette.accent },
                { key: "bg" as const, label: "پس‌زمینه", value: resolvedPalette.bg },
              ]).map((row) => (
                <div key={row.key} className="flex items-center gap-2.5">
                  <input
                    type="color"
                    aria-label={row.label}
                    value={row.value}
                    onChange={(e) => patchConfig({
                      customPalette: {
                        label: "رنگ دلخواه",
                        primary: resolvedPalette.primary,
                        accent: resolvedPalette.accent,
                        bg: resolvedPalette.bg,
                        [row.key]: e.target.value,
                      },
                    })}
                    className="w-10 h-10 rounded-xl border border-hairline p-1 shrink-0 cursor-pointer bg-transparent"
                  />
                  <span className="text-[12px] font-bold w-20 shrink-0">{row.label}</span>
                  <input
                    dir="ltr"
                    defaultValue={row.value}
                    placeholder="#00825E"
                    aria-label={`کد هگز ${row.label}`}
                    className="b-input !w-32 !h-10 !text-[13px] shrink-0"
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                        patchConfig({
                          customPalette: {
                            label: "رنگ دلخواه",
                            primary: resolvedPalette.primary,
                            accent: resolvedPalette.accent,
                            bg: resolvedPalette.bg,
                            [row.key]: v,
                          },
                        });
                      } else {
                        e.currentTarget.value = row.value;
                      }
                    }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                  <span className="w-6 h-6 rounded-full border border-hairline shrink-0" style={{ background: row.value }} />
                </div>
              ))}
              <p className="text-[11px] text-steel leading-relaxed">
                پالت فعلی: {resolvedPalette.label} — اصلی {resolvedPalette.primary} · لهجه {resolvedPalette.accent} · پس‌زمینه {resolvedPalette.bg}
                {config?.customPalette ? " (رنگ دلخواه فعال است)" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ───── متن‌ها و تصاویر ───── */}
      {tab === "content" && config && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Type className="w-4 h-4 text-spring" /> بخش هیرو</b>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">عنوان بزرگ</span>
              <input className="b-input" value={config.heroTitle} onChange={(e) => patchConfig({ heroTitle: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">زیرعنوان</span>
              <textarea rows={2} className="b-input !rounded-2xl resize-none" value={config.heroSubtitle} onChange={(e) => patchConfig({ heroSubtitle: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">متن دکمه پیش‌ثبت‌نام</span>
              <input className="b-input" value={config.ctaPrimary} onChange={(e) => patchConfig({ ctaPrimary: e.target.value })} />
            </label>
            <ImageField field="heroImage" label="تصویر هیرو" hint="نسبت ۴:۳ توصیه می‌شود" />
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Type className="w-4 h-4 text-spring" /> درباره و پیام مدیر</b>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">عنوان درباره</span>
              <input className="b-input" value={config.aboutTitle} onChange={(e) => patchConfig({ aboutTitle: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">متن درباره مدرسه</span>
              <textarea rows={4} className="b-input !rounded-2xl resize-none" value={config.aboutText} onChange={(e) => patchConfig({ aboutText: e.target.value })} />
            </label>
            <ImageField field="aboutImage" label="تصویر درباره" />
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">پیام مدیر</span>
              <textarea rows={3} className="b-input !rounded-2xl resize-none" value={config.principalMessage} onChange={(e) => patchConfig({ principalMessage: e.target.value })} />
            </label>
            <ImageField field="principalPhoto" label="تصویر مدیر" />
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><MapPin className="w-4 h-4 text-spring" /> تماس</b>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">تلفن (خالی = تلفن مدرسه)</span>
              <input className="b-input" dir="ltr" value={config.contactPhone} onChange={(e) => patchConfig({ contactPhone: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">آدرس (خالی = آدرس مدرسه)</span>
              <input className="b-input" value={config.contactAddress} onChange={(e) => patchConfig({ contactAddress: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">ساعات کاری</span>
              <input className="b-input" value={config.contactHours} onChange={(e) => patchConfig({ contactHours: e.target.value })} />
            </label>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2">گالری تصاویر</b>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {config.gallery.map((g, i) => (
                <div key={i} className="relative group">
                  <img src={g} alt={`گالری ${i + 1}`} className="w-full aspect-[4/3] object-cover rounded-xl border border-hairline" />
                  <button
                    type="button"
                    className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 max-md:opacity-100 transition-opacity"
                    onClick={() => patchConfig({ gallery: config.gallery.filter((_, x) => x !== i) })}
                    aria-label="حذف تصویر"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="b-btn b-btn-ghost aspect-[4/3] rounded-xl border-2 border-dashed border-hairline flex flex-col items-center justify-center gap-1 text-steel hover:border-spring/50 hover:text-spring transition-colors"
                onClick={() => pickFile("gallery")}
                disabled={uploading === "gallery"}
              >
                {uploading === "gallery" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                <span className="text-[10.5px] font-bold">افزودن</span>
              </button>
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4 lg:col-span-2">
            <b className="text-[13.5px]">سوالات متداول سایت مدرسه</b>
            {config.faq.map((f, i) => (
              <div key={i} className="b-card-sm !rounded-xl p-4 grid sm:grid-cols-[1fr_1.4fr_auto] gap-3 items-center">
                <input
                  className="b-input"
                  value={f.q}
                  onChange={(e) => {
                    const faq = [...config.faq];
                    faq[i] = { ...faq[i], q: e.target.value };
                    patchConfig({ faq });
                  }}
                  placeholder="سوال"
                />
                <input
                  className="b-input"
                  value={f.a}
                  onChange={(e) => {
                    const faq = [...config.faq];
                    faq[i] = { ...faq[i], a: e.target.value };
                    patchConfig({ faq });
                  }}
                  placeholder="پاسخ"
                />
                <button
                  type="button"
                  className="w-9 h-9 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10 shrink-0"
                  onClick={() => patchConfig({ faq: config.faq.filter((_, x) => x !== i) })}
                  aria-label="حذف سوال"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="b-btn b-btn-soft b-btn-sm self-start"
              onClick={() => patchConfig({ faq: [...config.faq, { q: "سوال جدید؟", a: "پاسخ…" }] })}
              disabled={config.faq.length >= 10}
            >
              <Plus className="w-3.5 h-3.5" /> افزودن سوال
            </button>
          </div>
        </div>
      )}

      {/* ───── بخش‌ها ───── */}
      {tab === "sections" && config && (
        <div className="b-card p-5">
          <b className="text-[13.5px] block mb-1">روشن/خاموش کردن بخش‌های سایت</b>
          <p className="text-[11.5px] text-steel mb-4">ترتیب و ساختار بخش‌ها در تمپلیت قفل است؛ فقط نمایش/عدم نمایش را کنترل می‌کنید.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {(Object.keys(SECTION_LABELS) as SiteSectionKey[]).map((key) => (
              <label key={key} className={`b-option !py-3 ${config.sections[key] ? "b-option-selected" : ""}`}>
                <input
                  type="checkbox"
                  className="accent-spring w-4 h-4"
                  checked={config.sections[key]}
                  onChange={() => toggleSection(key)}
                />
                <b className="text-[12px]">{SECTION_LABELS[key]}</b>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ───── انتشار و آدرس ───── */}
      {tab === "domain" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Globe className="w-4 h-4 text-spring" /> آدرس سایت مدرسه</b>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-bold">آدرس اختصاصی (حروف لاتین)</span>
              <div className="flex items-center" dir="ltr">
                <span className="h-11 px-3 rounded-l-full bg-cloud border border-hairline flex items-center text-[11.5px] text-steel">bahar.school/</span>
                <input className="b-input !rounded-l-none !rounded-r-full min-w-0" value={subdomain} onChange={(e) => setSubdomain(e.target.value)} />
              </div>
              {/* پیش‌نمایش زندهٔ آدرس نهایی (اسلاگ‌شدهٔ سمت سرور) */}
              <span className="text-[10.5px] text-stone font-bold" dir="ltr">→ /s/{effectiveSlug || "…"}</span>
              <span className="text-[10.5px] text-stone">
                سایت مدرسه در مسیر /s/{effectiveSlug || "…"} در دسترس است — اگر فارسی بنویسید، خودکار به حروف لاتین ترجمیه می‌شود. دامنه اختصاصی هم برای همهٔ مدارس در دسترس است.
              </span>
            </label>
            <div className="b-card-sm !rounded-xl p-4 text-[12.5px] leading-relaxed">
              <b className="flex items-center gap-1.5 text-[12px] mb-1.5"><Lock className="w-3.5 h-3.5" /> چه چیزهایی قابل تغییر نیست؟</b>
              ساختار صفحات، ترتیب بخش‌ها، فرم پیش‌ثبت‌نام، سئو پایه و امنیت سایت قفل هستند تا برند مدارس یکدست و امن بماند. مدیر فقط محتوا، تصویر، رنگ و نمایش بخش‌ها را کنترل می‌کند.
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-4">
            <b className="text-[13.5px] flex items-center gap-2"><Rocket className="w-4 h-4 text-spring" /> انتشار</b>
            <div className="b-card-sm !rounded-xl p-4 flex items-center gap-3">
              <span className={`b-badge ${published ? "b-badge-spring" : "b-badge-neutral"}`}>{published ? "منتشرشده" : "پیش‌نویس"}</span>
              <span className="text-[12px] text-steel">بازدید: {site.views.toLocaleString("fa-IR")}</span>
            </div>
            <div className="flex items-center gap-3">
              <button className="b-btn b-btn-spring" onClick={() => save(true)} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                {published ? "به‌روزرسانی و انتشار" : "انتشار سایت"}
              </button>
              {published && (
                <button className="b-btn b-btn-ghost !text-steel" onClick={() => save(false)} disabled={saving}>
                  لغو انتشار
                </button>
              )}
            </div>
            <p className="text-[11.5px] text-steel leading-relaxed">
              با انتشار، سایت در آدرس عمومی برای همه قابل مشاهده می‌شود و لینک آن را می‌توانید در اطلاعیه‌ها و شاد برای اولیا بفرستید.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
