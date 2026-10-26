// ============================================================
// بهار | آواتار Personas (Draftbit) — ابزار مشترک سرور/کلاینت
// ساخت URL، اعتبارسنجی، آواتار پیش‌فرض قطعی و فراداده دسته‌بندی‌ها
// ============================================================

export type AvatarParams = {
  hair: string;
  facialHair: string;
  body: string;
  eyes: string;
  mouth: string;
  nose: string;
  accessories: string;
  skinColor: string;
  hairColor: string;
  facialHairColor: string;
  bodyColor: string;
  accessoriesColor: string;
  bgColor: string;
};

export type AvatarOptions = {
  skinStyles: string[];
  hairStyles: string[];
  facialHairStyles: string[];
  bodyStyles: string[];
  eyeStyles: string[];
  mouthStyles: string[];
  noseStyles: string[];
  accessoryStyles: string[];
  bgStyles: string[];
  skinColors: string[];
  hairColors: string[];
  facialHairColors: string[];
  bodyColors: string[];
  accessoryColors: string[];
  bgColors: string[];
};

export const PERSONAS_BASE = "https://personas.draftbit.com/api/avatar.svg";
export const PERSONAS_OPTIONS_URL = "https://personas.draftbit.com/api/options";

/** آخرین گزینه‌های معتبر API — fallback شبکه و منبع آواتار پیش‌فرض قطعی (هرگز از API زنده ساخته نمی‌شود تا پیش‌فرض کاربران ثابت بماند) */
export const FALLBACK_OPTIONS: AvatarOptions = {
  skinStyles: ["Skin"],
  hairStyles: ["Bald", "Hat", "Balding", "Bigcurls", "Bobbangs", "Bobcut", "Buncurls", "Buzzcut", "Curlybun", "Hightopcurly", "Long", "Pigtails", "Shortcombover", "Beanie", "Bunundercut", "Extralong", "Fade", "Mohawk", "Shortcomboverchops", "Sidebuzz", "Straightbun"],
  facialHairStyles: ["BeardMustache", "Mustache", "None", "Goatee", "Shadow", "Soulpatch", "Walrus"],
  bodyStyles: ["Oval", "Round", "Square", "Checkered", "Hoodie", "Stripes"],
  eyeStyles: ["Glasses", "Happy", "Open", "Sleepy", "Sunglasses", "Wink", "Closed", "Hearts", "Dizzy", "Sideeye"],
  mouthStyles: ["Bigsmile", "Frown", "Lips", "Pacifier", "Smile", "Smirk", "Surprise", "Grin", "Tongue", "Whistle", "Laugh"],
  noseStyles: ["Mediumround", "Smallround", "Wrinkles", "Pointed", "Button"],
  accessoryStyles: ["None", "Earring", "Earrings"],
  bgStyles: ["Background"],
  skinColors: ["FFCC22", "FFDFC4", "FBD2C7", "F2AD9B", "E58F7B", "E4A070", "B16A5B", "92594B", "7A4536", "623D36", "C9E6DC", "C4B5F2"],
  hairColors: ["362C47", "675E97", "4E7DE0", "5AC4D4", "58B368", "DEE1F5", "6C4545", "F29C65", "F2C94C", "E16381", "E15C66", "979FB0"],
  facialHairColors: ["362C47", "675E97", "4E7DE0", "5AC4D4", "58B368", "DEE1F5", "6C4545", "F29C65", "F2C94C", "E16381", "E15C66", "979FB0"],
  bodyColors: ["456DFF", "5A45FF", "6DBB58", "F55D81", "7555CA", "E24553", "54D7C7", "F3B63A", "FF8A5C", "3E4E7C", "C866D9", "68C9F2"],
  accessoryColors: ["F3B63A", "C9CFDB", "C98850", "362C47", "F55D81", "54D7C7", "456DFF", "5A45FF"],
  bgColors: ["93A7FF", "A9E775", "FF7A9A", "B379F7", "FF6674", "89E6E4", "FFCC65", "FFB27A", "B8EBC5", "D9CCFF", "6C7BC4", "F8FBFF"],
};

/** پیش‌فرض‌های نمونهٔ رسمی — پایهٔ sanitize مقادیر ناقص */
const SAMPLE_PARAMS: AvatarParams = {
  hair: "Beanie", facialHair: "None", body: "Round", eyes: "Hearts", mouth: "Smirk",
  nose: "Smallround", accessories: "Earrings", skinColor: "F2AD9B", hairColor: "6C4545",
  facialHairColor: "F2C94C", bodyColor: "68C9F2", accessoriesColor: "456DFF", bgColor: "89E6E4",
};

// ---------- ساخت URL ----------

/** ساخت URL پارامتریک Personas از پیکربندی آواتار */
export function buildAvatarUrl(p: AvatarParams, size?: number): string {
  const qs = new URLSearchParams({
    hair: p.hair, facialHair: p.facialHair, body: p.body, eyes: p.eyes, mouth: p.mouth,
    nose: p.nose, accessories: p.accessories, skinColor: p.skinColor, hairColor: p.hairColor,
    facialHairColor: p.facialHairColor, bodyColor: p.bodyColor, accessoriesColor: p.accessoriesColor,
    bgColor: p.bgColor,
  });
  if (size && Number.isFinite(size) && size > 0) qs.set("size", String(Math.round(size)));
  return `${PERSONAS_BASE}?${qs.toString()}`;
}

// ---------- اعتبارسنجی ----------

const FIELD_TO_OPTIONS: Record<keyof AvatarParams, keyof AvatarOptions> = {
  hair: "hairStyles", facialHair: "facialHairStyles", body: "bodyStyles", eyes: "eyeStyles",
  mouth: "mouthStyles", nose: "noseStyles", accessories: "accessoryStyles",
  skinColor: "skinColors", hairColor: "hairColors", facialHairColor: "facialHairColors",
  bodyColor: "bodyColors", accessoriesColor: "accessoryColors", bgColor: "bgColors",
};

function isHex6(v: unknown): v is string {
  return typeof v === "string" && /^[0-9A-Fa-f]{6}$/.test(v);
}

/** پیکربندی را نسبت به گزینه‌های معتبر پاک‌سازی می‌کند؛ مقادیر نامعتبر با پیش‌فرض جایگزین می‌شوند. خروجی همیشه یک آواتار کامل معتبر است. */
export function sanitizeAvatarParams(raw: unknown, options: AvatarOptions = FALLBACK_OPTIONS): AvatarParams | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const out = { ...SAMPLE_PARAMS };
  let validCount = 0;
  for (const field of Object.keys(FIELD_TO_OPTIONS) as Array<keyof AvatarParams>) {
    const allowed = options[FIELD_TO_OPTIONS[field]];
    const v = r[field];
    if (typeof v === "string" && allowed.includes(v)) {
      out[field] = v;
      validCount++;
    }
  }
  // هیچ فیلد معتبری نبود → پیکربندی بی‌اعتبار
  return validCount > 0 ? out : null;
}

/** پارس امن رشتهٔ JSON ذخیره‌شده در DB */
export function parseAvatarConfig(json: string | null | undefined, options: AvatarOptions = FALLBACK_OPTIONS): AvatarParams | null {
  if (!json) return null;
  try {
    return sanitizeAvatarParams(JSON.parse(json), options);
  } catch {
    return null;
  }
}

// ---------- آواتار پیش‌فرض قطعی بر اساس شناسه کاربر ----------

/** هش FNV-1a — پایدار بین اجراها و محیط‌ها */
function fnv1a(str: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * آواتار پیش‌فرض قطعی — از شناسه کاربر ساخته می‌شود تا بین نشست‌ها ثابت بماند.
 * همیشه از FALLBACK_OPTIONS استفاده می‌کند تا تغییرات API گزینهٔ زنده، چهرهٔ کاربران را عوض نکند.
 */
export function defaultAvatarFor(userId: string): AvatarParams {
  const src = `${userId}::bahar::avatar`;
  const pick = (opts: string[], salt: number) => opts[fnv1a(src, 0x811c9dc5 + salt * 0x9e3779b9) % opts.length];
  return {
    hair: pick(FALLBACK_OPTIONS.hairStyles, 1),
    facialHair: pick(FALLBACK_OPTIONS.facialHairStyles, 2),
    body: pick(FALLBACK_OPTIONS.bodyStyles, 3),
    eyes: pick(FALLBACK_OPTIONS.eyeStyles, 4),
    mouth: pick(FALLBACK_OPTIONS.mouthStyles, 5),
    nose: pick(FALLBACK_OPTIONS.noseStyles, 6),
    accessories: pick(FALLBACK_OPTIONS.accessoryStyles, 7),
    skinColor: pick(FALLBACK_OPTIONS.skinColors, 8),
    hairColor: pick(FALLBACK_OPTIONS.hairColors, 9),
    facialHairColor: pick(FALLBACK_OPTIONS.facialHairColors, 10),
    bodyColor: pick(FALLBACK_OPTIONS.bodyColors, 11),
    accessoriesColor: pick(FALLBACK_OPTIONS.accessoryColors, 12),
    bgColor: pick(FALLBACK_OPTIONS.bgColors, 13),
  };
}

// ---------- ترکیب تصادفی (کلاینت) ----------

/** ترکیب کاملاً تصادفی از گزینه‌های معتبر — هر بار فراخوانی، ترکیب تازه */
export function randomAvatar(options: AvatarOptions): AvatarParams {
  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  return {
    hair: pick(options.hairStyles), facialHair: pick(options.facialHairStyles),
    body: pick(options.bodyStyles), eyes: pick(options.eyeStyles),
    mouth: pick(options.mouthStyles), nose: pick(options.noseStyles),
    accessories: pick(options.accessoryStyles), skinColor: pick(options.skinColors),
    hairColor: pick(options.hairColors), facialHairColor: pick(options.facialHairColors),
    bodyColor: pick(options.bodyColors), accessoriesColor: pick(options.accessoryColors),
    bgColor: pick(options.bgColors),
  };
}

// ---------- فیلدهای Prisma و سریالایز برای API ----------

/** سه فیلد لازم برای نمایش تصویر پروفایل — داخل select/include کوئری‌های User قرار می‌گیرد */
export const AVATAR_FIELDS = {
  profileImageType: true,
  photoUrl: true,
  avatarConfig: true,
} as const;

type AvatarCarrier = {
  profileImageType?: string | null;
  photoUrl?: string | null;
  avatarConfig?: string | null;
};

/** سریالایز فیلدهای تصویر برای پاسخ API — فقط تصویرِ فعال + پیکربندی پارس‌شده */
export function avatarApiFields(u: AvatarCarrier): {
  profileImageType: "upload" | "avatar" | null;
  photoUrl: string | null;
  avatar: AvatarParams | null;
} {
  const type = u.profileImageType === "upload" || u.profileImageType === "avatar" ? u.profileImageType : null;
  return {
    profileImageType: type,
    photoUrl: type === "upload" ? u.photoUrl ?? null : null,
    avatar: type === "avatar" ? parseAvatarConfig(u.avatarConfig) : null,
  };
}

/** فرم ورودی استاندارد کامپوننت UserAvatar */
export type AvatarUserInput = {
  id: string;
  firstName: string;
  lastName: string;
  profileImageType?: string | null;
  photoUrl?: string | null;
  avatar?: AvatarParams | null;
};

// ---------- فراداده دسته‌بندی‌های Avatar Builder ----------

export type AvatarCategory = {
  key: string;
  label: string;
  /** فیلد سبک (اگر دسته فقط رنگ دارد، null) */
  styleField: keyof AvatarParams | null;
  styleOptions: keyof AvatarOptions | null;
  /** عنوان بخش سبک در UI */
  styleLabel?: string;
  colorField: keyof AvatarParams | null;
  colorOptions: keyof AvatarOptions | null;
  /** عنوان بخش رنگ در UI */
  colorLabel?: string;
};

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { key: "skin", label: "پوست", styleField: null, styleOptions: null, colorField: "skinColor", colorOptions: "skinColors", colorLabel: "رنگ پوست" },
  { key: "hair", label: "مو", styleField: "hair", styleOptions: "hairStyles", styleLabel: "مدل مو", colorField: "hairColor", colorOptions: "hairColors", colorLabel: "رنگ مو" },
  { key: "facialHair", label: "ریش و سبیل", styleField: "facialHair", styleOptions: "facialHairStyles", styleLabel: "مدل ریش", colorField: "facialHairColor", colorOptions: "facialHairColors", colorLabel: "رنگ ریش" },
  { key: "body", label: "بدن و لباس", styleField: "body", styleOptions: "bodyStyles", styleLabel: "فرم بدن", colorField: "bodyColor", colorOptions: "bodyColors", colorLabel: "رنگ لباس" },
  { key: "eyes", label: "چشم", styleField: "eyes", styleOptions: "eyeStyles", styleLabel: "مدل چشم", colorField: null, colorOptions: null },
  { key: "mouth", label: "دهان", styleField: "mouth", styleOptions: "mouthStyles", styleLabel: "مدل دهان", colorField: null, colorOptions: null },
  { key: "nose", label: "بینی", styleField: "nose", styleOptions: "noseStyles", styleLabel: "مدل بینی", colorField: null, colorOptions: null },
  { key: "accessories", label: "اکسسوری", styleField: "accessories", styleOptions: "accessoryStyles", styleLabel: "مدل اکسسوری", colorField: "accessoriesColor", colorOptions: "accessoryColors", colorLabel: "رنگ اکسسوری" },
  { key: "bg", label: "پس‌زمینه", styleField: null, styleOptions: null, colorField: "bgColor", colorOptions: "bgColors", colorLabel: "رنگ پس‌زمینه" },
];

/** برچسب فارسی گزینه‌ها — مقدار نامعلوم به انگلیسی برمی‌گردد */
export const AVATAR_OPTION_LABELS: Record<string, string> = {
  // مو
  Bald: "طاس", Hat: "کلاه", Balding: "کم‌مو", Bigcurls: "فر درشت", Bobbangs: "چتری", Bobcut: "باب‌کات",
  Buncurls: "بون فر", Buzzcut: "ماشین‌کاری", Curlybun: "دُم فر", Hightopcurly: "فر مرتفع", Long: "بلند",
  Pigtails: "دو گیس", Shortcombover: "شانه‌شده", Beanie: "کلاه بافت", Bunundercut: "دُم‌بالا", Extralong: "خیلی بلند",
  Fade: "فِید", Mohawk: "موهاوک", Shortcomboverchops: "شانه‌شده پهلوکوتاه", Sidebuzz: "پهلوکوتاه", Straightbun: "دُم صاف",
  // ریش
  BeardMustache: "ریش و سبیل", Mustache: "سبیل", Goatee: "بزی", Shadow: "سایهٔ ریش", Soulpatch: "پچ چانه", Walrus: "سبیل ضخیم",
  // بدن
  Oval: "بیضی", Round: "گرد", Square: "مربع", Checkered: "شطرنجی", Hoodie: "هودی", Stripes: "راه‌راه",
  // چشم
  Glasses: "عینک", Happy: "خندان", Open: "باز", Sleepy: "خواب‌آلود", Sunglasses: "عینک آفتابی", Wink: "پلک‌زدن",
  Closed: "بسته", Hearts: "قلبی", Dizzy: "سرگردان", Sideeye: "نگاه کناری",
  // دهان
  Bigsmile: "لبخند بزرگ", Frown: "اخم", Lips: "لب‌ها", Pacifier: "پستانک", Smile: "لبخند", Smirk: "لبخند مکر",
  Surprise: "متعجب", Grin: "پوزخند", Tongue: "زبان‌دار", Whistle: "سوت", Laugh: "قهقهه",
  // بینی
  Mediumround: "گرد متوسط", Smallround: "گرد کوچک", Wrinkles: "چین‌دار", Pointed: "نوک‌تیز", Button: "دکمه‌ای",
  // اکسسوری
  None: "بدون", Earring: "گوشواره", Earrings: "گوشواره‌ها",
};

export function avatarOptionLabel(v: string): string {
  return AVATAR_OPTION_LABELS[v] ?? v;
}
