// بهار | instrumentation — راه‌اندازی موتورهای پس‌زمینه در سرور Node
// ① پروفایل کشور فعال در بوت هیدراته می‌شود (دیفالت: ایران)
// ② گزارش‌های زمان‌بندی‌شده هر ۱۵ دقیقه چک می‌شوند.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { getActiveCountry } = await import("@/lib/country/server");
    const country = await getActiveCountry();
    if (country.code !== "IR") {
      console.log(`[COUNTRY] بسته کشور فعال: ${country.code} — ${country.name} (تقویم ${country.calendar})`);
    }
  } catch (e) {
    console.error("[INSTRUMENTATION:COUNTRY]", e);
  }
  if (process.env.BAHAR_DISABLE_SCHEDULER === "1") return;
  try {
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  } catch (e) {
    console.error("[INSTRUMENTATION]", e);
  }
}
