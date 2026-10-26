// ============================================================
// بهار | اعتبارسنجی بسته کشور (CountryPack) — سمت سرور
// مثل validateLanguagePack: خطای دقیق فارسی + آمار بسته
// ============================================================
import type { CountryProfile, CountryPackValidation, CalendarKind } from "./types";
import { CALENDARS, COUNTRY_PACK_MAX_BYTES } from "./types";
import { enDigits } from "@/lib/persian";

const CODE_RE = /^[A-Z]{2,4}$/;
const LOCALE_RE = /^[a-z]{2,3}-[A-Z]{2,4}$/;
// FIX (راند ۱۸): «UTC» و موارد بدون اسلش هم IANA معتبرند
const TZ_RE = /^[A-Za-z]+(\/[A-Za-z0-9_+-]+)*$/;

function safeRegExp(source: string): RegExp | null {
  try {
    const re = new RegExp(source);
    // جلوگیری از ReDoS ساده — الگوهای بسیار طولانی/تکراری رد می‌شوند
    if (source.length > 200) return null;
    return re;
  } catch {
    return null;
  }
}

export function validateCountryPack(raw: unknown): { profile: CountryProfile | null; validation: CountryPackValidation } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const p = raw as Record<string, unknown> | null;
  if (!p || typeof p !== "object") {
    return { profile: null, validation: { ok: false, errors: ["داده بسته باید یک شیء JSON معتبر باشد."], warnings, stats: emptyStats() } };
  }

  // ---- فیلدهای رشته‌ای پایه ----
  const str = (k: string, max: number, required = true): string => {
    const v = p[k];
    if (typeof v !== "string" || !v.trim()) {
      if (required) errors.push(`فیلد «${k}» الزامی است (رشته غیرخالی).`);
      return "";
    }
    if (v.length > max) errors.push(`فیلد «${k}» بیش از حد بلند است (حداکثر ${max} نویسه).`);
    return v.trim();
  };

  const code = str("code", 4);
  if (code && !CODE_RE.test(code)) errors.push("«code» باید ۲ تا ۴ حرف بزرگ لاتین باشد (مثل IR، TR، AE).");
  const name = str("name", 60);
  const nativeName = str("nativeName", 60);
  const locale = str("locale", 10);
  if (locale && !LOCALE_RE.test(locale)) errors.push("«locale» باید قالب زبان-کشور باشد (مثل fa-IR یا tr-TR).");
  if (p.direction !== "rtl" && p.direction !== "ltr") errors.push("«direction» باید rtl یا ltr باشد.");

  const timezone = str("timezone", 50);
  if (timezone && !TZ_RE.test(timezone)) errors.push("«timezone» باید یک منطقه زمانی IANA معتبر باشد (مثل Asia/Tehran).");
  else if (timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    } catch {
      errors.push("«timezone» توسط Intl شناخته نمی‌شود.");
    }
  }

  const calendar = p.calendar;
  if (typeof calendar !== "string" || !CALENDARS.includes(calendar as CalendarKind)) {
    errors.push(`«calendar» باید یکی از این تقویم‌ها باشد: ${CALENDARS.join("، ")}.`);
  }

  if (p.digits !== "native" && p.digits !== "latin") errors.push("«digits» باید native یا latin باشد.");

  // ---- nationalId ----
  const nid = p.nationalId as Record<string, unknown> | undefined;
  if (!nid || typeof nid !== "object") {
    errors.push("بخش «nationalId» الزامی است.");
  } else {
    if (typeof nid.label !== "string" || !nid.label.trim()) errors.push("«nationalId.label» الزامی است (مثل «کد ملی»).");
    const alg = nid.algorithm;
    if (alg !== "iran-mod11" && alg !== "luhn" && alg !== "digits" && alg !== "none") {
      errors.push("«nationalId.algorithm» باید iran-mod11 | luhn | digits | none باشد.");
    }
    if (typeof nid.pattern !== "string" || !safeRegExp(nid.pattern)) {
      errors.push("«nationalId.pattern» باید یک regex معتبر و کوتاه باشد (مثل \"^\\\\d{10}$\").");
    }
    if (alg === "none" && typeof nid.pattern === "string" && nid.pattern.trim() === "") {
      // بدون الگو هم قابل قبول است
    } else if (typeof nid.pattern !== "string" || !nid.pattern.trim()) {
      errors.push("«nationalId.pattern» الزامی است.");
    }
    if (typeof nid.placeholder !== "string") errors.push("«nationalId.placeholder» الزامی است.");
    if (typeof nid.example !== "string" || !nid.example.trim()) errors.push("«nationalId.example» الزامی است (نمونه معتبر برای تست).");
    else if (alg === "iran-mod11" && nid.example) {
      // نمونه باید از خودِ checksum رد شود (ارقام فارسی/عربی هم نرمال می‌شوند)
      const digits = enDigits(String(nid.example)).replace(/\D/g, "");
      if (digits.length !== 10 || !iranMod11(digits)) {
        errors.push("«nationalId.example» با الگوریتم iran-mod11 سازگار نیست — یک کد ملی معتبر واقعی بگذارید.");
      }
    }
    if (nid.invalidMessage !== undefined && typeof nid.invalidMessage !== "string") {
      errors.push("«nationalId.invalidMessage» باید رشته باشد.");
    }
    if (typeof nid.invalidMessage === "string" && nid.invalidMessage.length > 200) {
      errors.push("«nationalId.invalidMessage» حداکثر ۲۰۰ نویسه.");
    }
    // XSS
    [nid.label, nid.placeholder, nid.invalidMessage].forEach((v, i) => {
      if (typeof v === "string" && /<[^>]*script|javascript:|on\w+\s*=/i.test(v)) {
        errors.push(`«nationalId» فیلد ${i} شامل محتوای خطرناک (script/on-event) است.`);
      }
    });
  }

  // ---- phone ----
  const ph = p.phone as Record<string, unknown> | undefined;
  if (!ph || typeof ph !== "object") {
    errors.push("بخش «phone» الزامی است.");
  } else {
    if (typeof ph.pattern !== "string" || !safeRegExp(ph.pattern)) errors.push("«phone.pattern» باید regex معتبر باشد (مثل \"^09\\\\d{9}$\").");
    if (typeof ph.placeholder !== "string") errors.push("«phone.placeholder» الزامی است.");
    if (typeof ph.example !== "string" || !ph.example.trim()) errors.push("«phone.example» الزامی است.");
    else if (typeof ph.pattern === "string") {
      const re = safeRegExp(ph.pattern);
      if (re && !re.test(String(ph.example))) warnings.push("«phone.example» با «phone.pattern» تطابق ندارد — بررسی کنید.");
    }
  }

  // ---- currency ----
  const cur = p.currency as Record<string, unknown> | undefined;
  if (!cur || typeof cur !== "object") {
    errors.push("بخش «currency» الزامی است.");
  } else {
    if (typeof cur.label !== "string" || !cur.label.trim()) errors.push("«currency.label» الزامی است (مثل «تومان»).");
    if (typeof cur.code !== "string" || !/^[A-Z]{3}$/.test(cur.code)) errors.push("«currency.code» باید ۳ حرف بزرگ باشد (مثل IRR).");
    const min = Number(cur.minAmount);
    const max = Number(cur.maxAmount);
    if (!Number.isFinite(min) || min < 0) errors.push("«currency.minAmount» باید عدد ≥ 0 باشد.");
    if (!Number.isFinite(max) || max <= 0 || max > 1e12) errors.push("«currency.maxAmount» باید عدد مثبت ≤ ۱۰¹² باشد.");
    if (Number.isFinite(min) && Number.isFinite(max) && min >= max) errors.push("«currency.minAmount» باید کمتر از maxAmount باشد.");
  }

  // ---- week ----
  const week = p.week as Record<string, unknown> | undefined;
  let workDaysOk = false;
  if (!week || typeof week !== "object") {
    errors.push("بخش «week» الزامی است.");
  } else {
    const wd = week.workDays;
    if (!Array.isArray(wd) || wd.length < 1 || wd.length > 7 || wd.some((d) => typeof d !== "number" || d < 1 || d > 7)) {
      errors.push("«week.workDays» باید آرایه‌ای از اعداد ۱ تا ۷ باشد (۱=شنبه … ۷=جمعه).");
    } else {
      workDaysOk = true;
      if (new Set(wd).size !== wd.length) errors.push("«week.workDays» نباید روز تکراری داشته باشد.");
      if (!wd.includes(1) && !wd.includes(2) && !wd.includes(3)) warnings.push("هفته کاری غیرمعمول است — روزهای ۱-۳ (شنبه تا دوشنبه) در کار نیستند.");
    }
    const labels = week.labels;
    if (
      !Array.isArray(labels) ||
      labels.length !== 8 ||
      typeof labels[0] !== "string" ||
      labels[0] !== "" ||
      labels.slice(1).some((l) => typeof l !== "string" || !l.trim())
    ) {
      errors.push("«week.labels» باید آرایه‌ای به طول ۸ باشد: [0]=\"\" و اندیس‌های ۱ تا ۷ برچسب روزها.");
    }
  }

  // ---- لیست‌های آموزشی ----
  const strList = (k: string, min: number, maxLen: number): string[] => {
    const v = p[k];
    if (!Array.isArray(v) || v.length < min) {
      errors.push(`«${k}» باید آرایه‌ای با حداقل ${min} مورد باشد.`);
      return [];
    }
    if (v.length > 100) errors.push(`«${k}» حداکثر ۱۰۰ مورد می‌تواند داشته باشد.`);
    const out: string[] = [];
    v.forEach((item) => {
      if (typeof item !== "string" || !item.trim() || item.length > maxLen) {
        errors.push(`آیتم‌های «${k}» باید رشته‌های کوتاه غیرخالی باشند.`);
      } else out.push(item.trim());
    });
    return out;
  };
  const gradeLevels = strList("gradeLevels", 1, 30);
  const fields = strList("fields", 1, 30);
  const schoolTypes = strList("schoolTypes", 1, 30);

  // ---- regions ----
  const regionsRaw = p.regions;
  let regionCount = 0;
  let countyCount = 0;
  if (!Array.isArray(regionsRaw) || regionsRaw.length < 1) {
    errors.push("«regions» الزامی است — حتی یک کشور بدون استان هم باید یک منطقه (مثلاً «سراسر کشور») داشته باشد.");
  } else if (regionsRaw.length > 100) {
    errors.push("«regions» حداکثر ۱۰۰ استان/ایالت می‌تواند داشته باشد.");
  } else {
    const names = new Set<string>();
    regionsRaw.forEach((r, i) => {
      const reg = r as Record<string, unknown>;
      if (typeof reg.name !== "string" || !reg.name.trim() || reg.name.length > 60) {
        errors.push(`regions[${i}].name باید رشته غیرخالی ≤ ۶۰ نویسه باشد.`);
        return;
      }
      if (names.has(reg.name)) errors.push(`regions[${i}].name تکراری است: «${reg.name}».`);
      names.add(reg.name);
      if (typeof reg.center !== "string" || !reg.center.trim()) errors.push(`regions[${i}].center الزامی است.`);
      const counties = reg.counties;
      if (!Array.isArray(counties)) {
        errors.push(`regions[${i}].counties باید آرایه باشد.`);
        return;
      }
      if (counties.length > 150) errors.push(`regions[${i}].counties حداکثر ۱۵۰ شهرستان.`);
      const cNames = new Set<string>();
      counties.forEach((c) => {
        if (typeof c !== "string" || !c.trim() || c.length > 60) {
          errors.push(`regions[${i}].counties شامل مقدار نامعتبر است.`);
        } else if (cNames.has(c)) {
          warnings.push(`regions[${i}] شهرستان تکراری دارد: «${c}».`);
          cNames.add(c);
        } else cNames.add(c);
      });
      regionCount += 1;
      countyCount += counties.length;
    });
  }

  // ---- grading ----
  const gr = p.grading as Record<string, unknown> | undefined;
  if (!gr || typeof gr !== "object") {
    errors.push("بخش «grading» الزامی است.");
  } else {
    const maxScore = Number(gr.maxScore);
    if (!Number.isFinite(maxScore) || maxScore < 5 || maxScore > 200) errors.push("«grading.maxScore» باید عدد ۵ تا ۲۰۰ باشد (ایران: ۲۰).");
    const terms = Number(gr.terms);
    if (!Number.isFinite(terms) || terms < 1 || terms > 4) errors.push("«grading.terms» باید ۱ تا ۴ باشد.");
    const tl = gr.termLabels;
    const expectedLen = Number.isFinite(terms) ? terms + 1 : -1;
    if (
      !Array.isArray(tl) ||
      tl.length !== expectedLen ||
      typeof tl[0] !== "string" ||
      tl[0] !== "" ||
      tl.slice(1).some((l) => typeof l !== "string" || !l.trim())
    ) {
      errors.push("«grading.termLabels» آرایه‌ای به طول terms+1 با [0]=\"\" و برچسب نیمسال‌ها باشد.");
    }
  }

  const academicYearExample = str("academicYearExample", 20);

  // ---- modules ----
  const mods = p.modules as Record<string, unknown> | undefined;
  if (!mods || typeof mods !== "object" || typeof mods.shad !== "boolean") {
    errors.push("«modules.shad» الزامی است (boolean — خارج از ایران false بگذارید).");
  }

  // ---- map (اختیاری) ----
  let hasMap = false;
  let mapProvinces = 0;
  const map = p.map as Record<string, unknown> | undefined | null;
  if (map != null && typeof map === "object") {
    const vb = map.viewBox as Record<string, unknown> | undefined;
    const w = Number(vb?.w);
    const h = Number(vb?.h);
    if (!Number.isFinite(w) || !Number.isFinite(h) || w < 50 || w > 4000 || h < 50 || h > 4000) {
      errors.push("«map.viewBox» باید {w,h} اعداد ۵۰ تا ۴۰۰۰ باشد.");
    }
    const provs = map.provinces;
    if (!Array.isArray(provs) || provs.length < 1) {
      errors.push("«map.provinces» باید آرایه‌ای غیرخالی باشد (یا کل بخش map را حذف کنید).");
    } else if (provs.length > 100) {
      errors.push("«map.provinces» حداکثر ۱۰۰ استان.");
    } else {
      const regionNames = new Set(Array.isArray(regionsRaw) ? regionsRaw.map((r) => (r as Record<string, unknown>).name as string) : []);
      provs.forEach((pr, i) => {
        const pp = pr as Record<string, unknown>;
        if (typeof pp.name !== "string" || !pp.name.trim()) errors.push(`map.provinces[${i}].name الزامی است.`);
        else if (regionNames.size > 0 && !regionNames.has(pp.name)) {
          warnings.push(`map.provinces[${i}].name («${pp.name}») در «regions» نیست — دکمه نقشه آن را انتخاب نمی‌کند.`);
        }
        if (typeof pp.d !== "string" || !/^M|m/.test(pp.d) || pp.d.length < 20) errors.push(`map.provinces[${i}].d باید مسیر SVG معتبر باشد (شروع با M).`);
        else if (pp.d.length > 30000) warnings.push(`map.provinces[${i}].d بسیار طولانی است (>۳۰KB) — ساده‌سازی Douglas-Peucker را اجرا کنید.`);
        const cx = Number(pp.cx);
        const cy = Number(pp.cy);
        if (!Number.isFinite(cx) || !Number.isFinite(cy)) warnings.push(`map.provinces[${i}].cx/cy عدد نیست — برچسب hover جابه‌جا می‌شود.`);
      });
      hasMap = true;
      mapProvinces = provs.length;
    }
  }

  const bytes = Buffer.byteLength(JSON.stringify(raw), "utf8");
  if (bytes > COUNTRY_PACK_MAX_BYTES) errors.push(`حجم بسته (${Math.round(bytes / 1024)}KB) از سقف ${COUNTRY_PACK_MAX_BYTES / 1024}KB بیشتر است.`);
  if (map && bytes > 100 * 1024) warnings.push("بسته سنگین است (بیش از ۱۰۰KB) — بیشترش احتمالاً نقشه SVG است؛ ساده‌سازی بیشتر توصیه می‌شود.");

  if (!errors.length && workDaysOk) {
    if ((calendar as string) !== "persian" && code === "IR") warnings.push("کد IR با تقویم غیرشمسی ترکیب عجیبی است — مطمئن شوید.");
    if (gradeLevels.length && gradeLevels.length < 3) warnings.push("پایه‌های تحصیلی کمتر از ۳ مورد است — برای مدرسه واقعی کافی نیست.");
  }

  const validation: CountryPackValidation = {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: { regions: regionCount, counties: countyCount, workDays: Array.isArray((p.week as Record<string, unknown> | undefined)?.workDays) ? ((p.week as Record<string, unknown>).workDays as unknown[]).length : 0, gradeLevels: gradeLevels.length, hasMap, mapProvinces, bytes },
  };

  if (!validation.ok) return { profile: null, validation };

  // پروفایل نرمال‌شده (فیلدهای اختیاری پاک‌سازی‌شده)
  const profile: CountryProfile = {
    code,
    name,
    nativeName,
    locale,
    direction: p.direction as "rtl" | "ltr",
    timezone,
    calendar: calendar as CalendarKind,
    digits: p.digits as "native" | "latin",
    nationalId: {
      label: (nid!.label as string).trim(),
      algorithm: nid!.algorithm as CountryProfile["nationalId"]["algorithm"],
      pattern: typeof nid!.pattern === "string" ? nid!.pattern : "",
      placeholder: (nid!.placeholder as string).trim(),
      example: (nid!.example as string).trim(),
      invalidMessage: typeof nid!.invalidMessage === "string" ? nid!.invalidMessage.slice(0, 200) : undefined,
    },
    phone: { pattern: (ph!.pattern as string).trim(), placeholder: (ph!.placeholder as string).trim(), example: (ph!.example as string).trim() },
    currency: {
      label: (cur!.label as string).trim(),
      code: (cur!.code as string).trim(),
      minAmount: Number(cur!.minAmount),
      maxAmount: Number(cur!.maxAmount),
    },
    week: { workDays: (p.week as Record<string, unknown>).workDays as number[], labels: (p.week as Record<string, unknown>).labels as string[] },
    gradeLevels,
    fields,
    schoolTypes,
    regions: (regionsRaw as CountryProfile["regions"]).map((r) => ({ name: r.name.trim(), center: r.center.trim(), counties: r.counties.map((c) => c.trim()) })),
    map: hasMap
      ? {
          viewBox: {
            w: Number((map as Record<string, unknown>).viewBox && ((map as Record<string, unknown>).viewBox as Record<string, unknown>).w),
            h: Number((map as Record<string, unknown>).viewBox && ((map as Record<string, unknown>).viewBox as Record<string, unknown>).h),
          },
          provinces: ((map as Record<string, unknown>).provinces as Array<Record<string, unknown>>).map((pp) => ({
            name: String(pp.name).trim(),
            d: String(pp.d),
            cx: Number(pp.cx) || 0,
            cy: Number(pp.cy) || 0,
          })),
        }
      : undefined,
    grading: {
      maxScore: Number(gr!.maxScore),
      terms: Number(gr!.terms),
      termLabels: (gr!.termLabels as string[]),
    },
    academicYearExample,
    modules: { shad: Boolean((mods as Record<string, unknown>).shad) },
    notes: typeof p.notes === "string" ? p.notes.slice(0, 500) : undefined,
    version: typeof p.version === "string" ? p.version.slice(0, 20) : undefined,
  };

  return { profile, validation };
}

/** رقم کنترل کد ملی ایران (mod-11) */
function iranMod11(id: string): boolean {
  if (!/^\d{10}$/.test(id) || /^(\d)\1{9}$/.test(id)) return false;
  const sum = id.slice(0, 9).split("").reduce((s, ch, i) => s + Number(ch) * (10 - i), 0);
  const rem = sum % 11;
  const check = Number(id[9]);
  return rem < 2 ? check === rem : check === 11 - rem;
}

function emptyStats() {
  return { regions: 0, counties: 0, workDays: 0, gradeLevels: 0, hasMap: false, mapProvinces: 0, bytes: 0 };
}
