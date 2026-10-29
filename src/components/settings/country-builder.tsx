"use client";

/* ============================================================
   بهار | فرم ساخت بستهٔ کشور (راند ۱۸)
   رابط کاربری کامل برای ساخت CountryProfile داخل پنل — بدون نیاز
   به JSON. تقویم از میان ۱۳ نوع قابل انتخاب است؛ اعتبارسنجی
   سمت سرور (dry-run) قبل از ذخیره انجام می‌شود.
   ============================================================ */

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Globe2, Plus, Trash2, Loader2, CheckCircle2, Wand2 } from "lucide-react";
import { apiPost } from "@/lib/client";
import { Select } from "@/components/shared/pickers";
import { CALENDAR_LABELS, ALGORITHM_LABELS, IRAN_PROFILE } from "@/lib/country/iran";
import type { CountryProfile } from "@/lib/country/types";

const DAY_LABELS = ["", "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];
const TIMEZONES = [
  "Asia/Tehran", "Asia/Istanbul", "Asia/Dubai", "Asia/Riyadh", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo",
  "Europe/London", "Europe/Berlin", "Europe/Paris", "America/New_York", "America/Los_Angeles", "UTC",
];
const DIRECTION_OPTIONS = [
  { value: "rtl", label: "راست‌به‌چپ (RTL)" },
  { value: "ltr", label: "چپ‌به‌راست (LTR)" },
];
const DIGITS_OPTIONS = [
  { value: "native", label: "ارقام بومی (۱۲۳)" },
  { value: "latin", label: "ارقام لاتین (123)" },
];

type RegionDraft = { name: string; center: string; counties: string };

const blankForm = {
  code: "",
  name: "",
  nativeName: "",
  locale: "",
  direction: "rtl",
  timezone: "Asia/Tehran",
  calendar: "gregory",
  digits: "latin",
  nationalIdLabel: "کد ملی",
  nationalIdAlgorithm: "digits",
  nationalIdPattern: "^\\d{10}$",
  nationalIdPlaceholder: "۱۰ رقم",
  nationalIdExample: "1234567890",
  nationalIdInvalid: "",
  phonePattern: "^\\d{10}$",
  phonePlaceholder: "5xx xxx xxxx",
  phoneExample: "5012345678",
  currencyLabel: "",
  currencyCode: "",
  currencyMin: "0",
  currencyMax: "100000000",
  workDays: [1, 2, 3, 4, 5] as number[],
  gradeLevels: "",
  fields: "",
  schoolTypes: "",
  regions: [] as RegionDraft[],
  maxScore: "20",
  terms: "2",
  termLabels: ",نیمسال اول,نیمسال دوم",
  academicYearExample: "2025-2026",
  shad: false,
  notes: "",
};

function splitList(s: string): string[] {
  return s.split(/[,،\n]/).map((x) => x.trim()).filter(Boolean);
}

export function CountryBuilder({ onCreated }: { onCreated?: () => void }) {
  const [f, setF] = useState({ ...blankForm });
  const [busy, setBusy] = useState(false);
  const [issues, setIssues] = useState<{ errors: string[]; warnings: string[] }>({ errors: [], warnings: [] });

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  /** پیش‌پرکردن هوشمند از بستهٔ ایران به‌عنوان پایه */
  function prefillFromIran() {
    setF({
      ...blankForm,
      direction: IRAN_PROFILE.direction,
      timezone: IRAN_PROFILE.timezone,
      calendar: IRAN_PROFILE.calendar,
      digits: IRAN_PROFILE.digits,
      nationalIdLabel: IRAN_PROFILE.nationalId.label,
      nationalIdAlgorithm: IRAN_PROFILE.nationalId.algorithm,
      nationalIdPattern: IRAN_PROFILE.nationalId.pattern,
      nationalIdPlaceholder: IRAN_PROFILE.nationalId.placeholder,
      nationalIdExample: IRAN_PROFILE.nationalId.example,
      phonePattern: IRAN_PROFILE.phone.pattern,
      phonePlaceholder: IRAN_PROFILE.phone.placeholder,
      phoneExample: IRAN_PROFILE.phone.example,
      currencyLabel: IRAN_PROFILE.currency.label,
      currencyCode: IRAN_PROFILE.currency.code,
      currencyMin: String(IRAN_PROFILE.currency.minAmount),
      currencyMax: String(IRAN_PROFILE.currency.maxAmount),
      workDays: [...IRAN_PROFILE.week.workDays],
      gradeLevels: IRAN_PROFILE.gradeLevels.join("، "),
      fields: IRAN_PROFILE.fields.join("، "),
      schoolTypes: IRAN_PROFILE.schoolTypes.join("، "),
      regions: IRAN_PROFILE.regions.slice(0, 4).map((r) => ({ name: r.name, center: r.center, counties: r.counties.slice(0, 4).join("، ") })),
      maxScore: String(IRAN_PROFILE.grading.maxScore),
      terms: String(IRAN_PROFILE.grading.terms),
      termLabels: IRAN_PROFILE.grading.termLabels.join(","),
      academicYearExample: IRAN_PROFILE.academicYearExample,
      shad: false,
    });
    toast.info("قالب ایران به‌عنوان پایه پر شد — مقادیر را برای کشور جدید تغییر دهید.");
  }

  function buildProfile(): CountryProfile {
    return {
      code: f.code.trim().toUpperCase().slice(0, 2),
      name: f.name.trim(),
      nativeName: f.nativeName.trim(),
      locale: f.locale.trim(),
      direction: f.direction === "ltr" ? "ltr" : "rtl",
      timezone: f.timezone,
      calendar: f.calendar as CountryProfile["calendar"],
      digits: f.digits === "native" ? "native" : "latin",
      nationalId: {
        label: f.nationalIdLabel.trim(),
        algorithm: f.nationalIdAlgorithm as CountryProfile["nationalId"]["algorithm"],
        pattern: f.nationalIdPattern.trim(),
        placeholder: f.nationalIdPlaceholder.trim(),
        example: f.nationalIdExample.trim(),
        ...(f.nationalIdInvalid.trim() ? { invalidMessage: f.nationalIdInvalid.trim() } : {}),
      },
      phone: {
        pattern: f.phonePattern.trim(),
        placeholder: f.phonePlaceholder.trim(),
        example: f.phoneExample.trim(),
      },
      currency: {
        label: f.currencyLabel.trim(),
        code: f.currencyCode.trim().toUpperCase(),
        minAmount: Math.max(0, Number(f.currencyMin) || 0),
        maxAmount: Math.max(100, Number(f.currencyMax) || 100000000),
      },
      week: {
        workDays: f.workDays,
        labels: DAY_LABELS,
      },
      gradeLevels: splitList(f.gradeLevels),
      fields: splitList(f.fields),
      schoolTypes: splitList(f.schoolTypes),
      regions: f.regions
        .filter((r) => r.name.trim())
        .map((r) => ({ name: r.name.trim(), center: r.center.trim(), counties: splitList(r.counties) })),
      grading: {
        maxScore: Math.max(1, Number(f.maxScore) || 20),
        terms: Math.max(1, Math.min(4, Number(f.terms) || 2)),
        termLabels: ["", ...splitList(f.termLabels)],
      },
      academicYearExample: f.academicYearExample.trim(),
      modules: { shad: f.shad },
      notes: f.notes.trim() || undefined,
    };
  }

  async function submit() {
    if (!f.code.trim() || !f.name.trim() || !f.nativeName.trim()) {
      toast.error("کد، نام و نام بومی کشور الزامی است.");
      return;
    }
    setBusy(true);
    setIssues({ errors: [], warnings: [] });
    try {
      const profile = buildProfile();
      // مرحله ۱ — اعتبارسنجی خشک
      const dry = await apiPost<{ valid: boolean; errors?: string[]; warnings?: string[] }>("/api/countries?validate=1", profile);
      if (!dry.valid) {
        setIssues({ errors: dry.errors ?? [], warnings: dry.warnings ?? [] });
        toast.error("بستهٔ کشور اعتبارسنجی را رد نکرد — خطاها را اصلاح کنید.");
        return;
      }
      // مرحله ۲ — ذخیره
      const res = await apiPost<{ pack?: { id?: string }; warnings?: string[] }>("/api/countries", profile);
      setIssues({ errors: [], warnings: dry.warnings ?? res.warnings ?? [] });
      toast.success(`بستهٔ کشور «${profile.nativeName}» ذخیره شد (غیرفعال) — از فهرست پایین فعالش کنید.`);
      setF({ ...blankForm });
      onCreated?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "خطا در ساخت بسته");
    } finally {
      setBusy(false);
    }
  }

  const calendarOptions = useMemo(
    () => Object.entries(CALENDAR_LABELS).map(([value, label]) => ({ value, label })),
    []
  );
  const algorithmOptions = useMemo(
    () => Object.entries(ALGORITHM_LABELS).map(([value, label]) => ({ value, label })),
    []
  );

  return (
    <div className="b-card-sm !rounded-2xl p-4 md:p-5 flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="font-bold text-[14px] flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-spring" /> ساخت بستهٔ کشور با فرم
        </h3>
        <button className="b-btn b-btn-ghost b-btn-sm !text-[12px]" onClick={prefillFromIran} type="button">
          <Globe2 className="w-3.5 h-3.5" /> پرکردن از قالب ایران
        </button>
      </div>
      <p className="t-sm text-steel leading-relaxed">
        همهٔ تنظیمات یک کشور/ریجن را اینجا بسازید — نوع تقویم، الگوریتم کد ملی، ارز، هفته، پایه‌ها و مناطق. ذخیره اولیه غیرفعال است؛ بعد از ساخت از فهرست فعالش کنید.
      </p>

      {/* ── هویت ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">هویت کشور</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">کد ۲ حرفی * (مثل TR)</span>
            <input className="b-input !h-10" dir="ltr" placeholder="TR" value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نام (فارسی) *</span>
            <input className="b-input !h-10" placeholder="ترکیه" value={f.name} onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نام بومی *</span>
            <input className="b-input !h-10" placeholder="Türkiye" value={f.nativeName} onChange={(e) => set("nativeName", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">locale</span>
            <input className="b-input !h-10" dir="ltr" placeholder="tr-TR" value={f.locale} onChange={(e) => set("locale", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">جهت متن</span>
            <Select value={f.direction} onChange={(v) => set("direction", v)} options={DIRECTION_OPTIONS} buttonClassName="!h-10" className="w-full" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">منطقه زمانی</span>
            <Select value={f.timezone} onChange={(v) => set("timezone", v)} searchable options={TIMEZONES.map((t) => ({ value: t, label: t }))} buttonClassName="!h-10" className="w-full" />
          </label>
        </div>
      </div>

      {/* ── تقویم و ارقام ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">تقویم و ارقام</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نوع تقویم *</span>
            <Select value={f.calendar} onChange={(v) => set("calendar", v)} searchable options={calendarOptions} buttonClassName="!h-10" className="w-full" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نمایش ارقام</span>
            <Select value={f.digits} onChange={(v) => set("digits", v)} options={DIGITS_OPTIONS} buttonClassName="!h-10" className="w-full" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نمونهٔ سال تحصیلی</span>
            <input className="b-input !h-10" dir="ltr" placeholder="2025-2026" value={f.academicYearExample} onChange={(e) => set("academicYearExample", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── کد ملی و موبایل ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">کد ملی و موبایل</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">برچسب شناسه ملی</span>
            <input className="b-input !h-10" placeholder="کد ملی" value={f.nationalIdLabel} onChange={(e) => set("nationalIdLabel", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">الگوریتم اعتبارسنجی</span>
            <Select value={f.nationalIdAlgorithm} onChange={(v) => set("nationalIdAlgorithm", v)} options={algorithmOptions} buttonClassName="!h-10" className="w-full" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">الگوی کد ملی (regex)</span>
            <input className="b-input !h-10 font-mono !text-[12px]" dir="ltr" placeholder="^\d{11}$" value={f.nationalIdPattern} onChange={(e) => set("nationalIdPattern", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نمونهٔ کد ملی</span>
            <input className="b-input !h-10" dir="ltr" value={f.nationalIdExample} onChange={(e) => set("nationalIdExample", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">الگوی موبایل (regex)</span>
            <input className="b-input !h-10 font-mono !text-[12px]" dir="ltr" placeholder="^\+90\d{10}$" value={f.phonePattern} onChange={(e) => set("phonePattern", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نمونهٔ موبایل</span>
            <input className="b-input !h-10" dir="ltr" value={f.phoneExample} onChange={(e) => set("phoneExample", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── ارز و نمره ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">ارز و نظام نمره</h4>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">واحد پول (نمایش)</span>
            <input className="b-input !h-10" placeholder="لیر" value={f.currencyLabel} onChange={(e) => set("currencyLabel", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">کد ارز</span>
            <input className="b-input !h-10" dir="ltr" placeholder="TRY" value={f.currencyCode} onChange={(e) => set("currencyCode", e.target.value.toUpperCase())} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نمرهٔ کامل</span>
            <input className="b-input !h-10" dir="ltr" inputMode="numeric" value={f.maxScore} onChange={(e) => set("maxScore", e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">تعداد نیمسال</span>
            <input className="b-input !h-10" dir="ltr" inputMode="numeric" value={f.terms} onChange={(e) => set("terms", e.target.value.replace(/[^0-9]/g, ""))} />
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[12px] font-bold">برچسب نیمسال‌ها (با ویرگول)</span>
            <input className="b-input !h-10" placeholder="نیمسال اول، نیمسال دوم" value={f.termLabels} onChange={(e) => set("termLabels", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── هفته ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">هفتهٔ آموزشی — روزهای کاری را انتخاب کنید</h4>
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6, 7].map((d) => {
            const on = f.workDays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  set("workDays", on ? f.workDays.filter((x) => x !== d) : [...f.workDays, d].sort((a, b) => a - b))
                }
                className={`b-pill-tab !py-1.5 !px-3.5 ${on ? "b-pill-tab-active" : ""}`}
                aria-pressed={on}
              >
                {DAY_LABELS[d]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── پایه/رشته/نوع مدرسه ── */}
      <div>
        <h4 className="text-[12px] font-bold mb-2.5 text-spring-deep">پایه‌ها، رشته‌ها و انواع مدرسه (با ویرگول جدا کنید)</h4>
        <div className="grid sm:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">پایه‌های تحصیلی</span>
            <input className="b-input !h-10" placeholder="نهم، دهم، یازدهم، دوازدهم" value={f.gradeLevels} onChange={(e) => set("gradeLevels", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">رشته‌ها</span>
            <input className="b-input !h-10" placeholder="ریاضی، تجربی…" value={f.fields} onChange={(e) => set("fields", e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">انواع مدرسه</span>
            <input className="b-input !h-10" placeholder="دولتی، خصوصی…" value={f.schoolTypes} onChange={(e) => set("schoolTypes", e.target.value)} />
          </label>
        </div>
      </div>

      {/* ── مناطق ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-[12px] font-bold text-spring-deep">مناطق (استان/ایالت + شهرستان‌ها)</h4>
          <button
            type="button"
            className="b-btn b-btn-ghost b-btn-sm !text-[12px]"
            onClick={() => set("regions", [...f.regions, { name: "", center: "", counties: "" }])}
          >
            <Plus className="w-3.5 h-3.5" /> افزودن منطقه
          </button>
        </div>
        {f.regions.length === 0 && (
          <p className="t-sm text-steel">منطقه‌ای تعریف نشده — برای انتخاب موقعیت مدرسه‌ها حداقل یک منطقه اضافه کنید (اختیاری).</p>
        )}
        <div className="flex flex-col gap-2.5">
          {f.regions.map((r, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_1fr_1.6fr_auto] gap-2 items-end b-card-sm !rounded-xl p-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-bold">نام منطقه</span>
                <input className="b-input !h-9" placeholder="استان آنکارا" value={r.name} onChange={(e) => set("regions", f.regions.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-bold">مرکز</span>
                <input className="b-input !h-9" placeholder="آنکارا" value={r.center} onChange={(e) => set("regions", f.regions.map((x, j) => (j === i ? { ...x, center: e.target.value } : x)))} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-bold">شهرستان‌ها (با ویرگول)</span>
                <input className="b-input !h-9" placeholder="چانکایا، کچی‌اورن…" value={r.counties} onChange={(e) => set("regions", f.regions.map((x, j) => (j === i ? { ...x, counties: e.target.value } : x)))} />
              </label>
              <button
                type="button"
                className="b-btn b-btn-ghost !min-h-9 !p-2 !text-destructive"
                onClick={() => set("regions", f.regions.filter((_, j) => j !== i))}
                aria-label="حذف منطقه"
                title="حذف منطقه"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── ماژول شاد ── */}
      <div className="b-card-sm !rounded-xl p-3.5 flex items-center gap-3">
        <button
          type="button"
          onClick={() => set("shad", !f.shad)}
          className={`b-option !items-start !py-3 flex-1 ${f.shad ? "b-option-selected" : ""}`}
          aria-pressed={f.shad}
        >
          <span className="flex flex-col items-start gap-0.5">
            <b className="text-[12px]">ماژول شاد (شبکهٔ ملی ایران)</b>
            <span className="text-[12px] text-steel leading-relaxed">
              فقط برای کشور ایران روشن کنید — برای ریجن‌های دیگر نامی از شاد در سامانه دیده نمی‌شود.
            </span>
          </span>
          <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${f.shad ? "bg-spring" : "bg-cloud"}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${f.shad ? "start-5" : "start-1"}`} />
          </span>
        </button>
      </div>

      {/* ── خطاها/هشدارها ── */}
      {(issues.errors.length > 0 || issues.warnings.length > 0) && (
        <div className="flex flex-col gap-1.5">
          {issues.errors.map((e, i) => (
            <p key={`e${i}`} className="text-[12px] text-destructive flex items-start gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 rotate-180" /> {e}</p>
          ))}
          {issues.warnings.map((w, i) => (
            <p key={`w${i}`} className="text-[12px] text-warning-deep">⚠ {w}</p>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <button className="b-btn b-btn-spring" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe2 className="w-4 h-4" />}
          ساخت و ذخیرهٔ بستهٔ کشور
        </button>
        <button className="b-btn b-btn-ghost !text-steel" onClick={() => setF({ ...blankForm })} disabled={busy} type="button">
          بازنشانی فرم
        </button>
      </div>
    </div>
  );
}
