// بهار | زبان پیش‌فرض مرورگر — بدون وابستگی به بسته‌های سنگین
// Accept-Language یا navigator.language را به کد اولیه (fa/en/…) تبدیل می‌کند.
// اگر زبان مرورگر در فهرست موجود نباشد، فراخواننده باید به fa برگردد.

export function primaryLangCode(value: string | null | undefined): string {
  if (!value) return "fa";
  const first = value.split(",")[0]?.trim().toLowerCase() ?? "";
  const code = first.split("-")[0]?.split("_")[0] ?? "";
  return /^[a-z]{2,15}$/.test(code) ? code : "fa";
}

export function browserLangCode(available: string[]): string {
  const code = primaryLangCode(
    typeof navigator !== "undefined" ? navigator.language : null
  );
  return available.includes(code) ? code : "fa";
}

export function acceptLangCode(header: string | null, available: string[]): string {
  if (!header) return "fa";
  for (const part of header.split(",")) {
    const code = primaryLangCode(part.split(";")[0]);
    if (available.includes(code)) return code;
  }
  return "fa";
}
