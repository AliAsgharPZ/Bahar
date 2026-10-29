import { cookies } from "next/headers";
import { Landing } from "@/components/landing/landing";
import { verifyToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getActiveCountryPublic } from "@/lib/country/server";
import { siteStringsFor, SITE_LANGS } from "@/lib/langs/shipped";

export default async function Home() {
  let isLoggedIn = false;
  try {
    const store = await cookies();
    const token = store.get(SESSION_COOKIE_NAME)?.value;
    if (token && verifyToken(token)) isLoggedIn = true;
  } catch {
    /* نادیده */
  }
  // فایل‌های اپ اندروید/ویندوز که سوپرادمین از تنظیمات آپلود کرده
  let androidUrl: string | null = null;
  let windowsUrl: string | null = null;
  try {
    const s = await getSettings();
    androidUrl = s.androidAppUrl || null;
    windowsUrl = s.windowsAppUrl || null;
  } catch {
    /* نادیده */
  }
  // شاد فقط برای بسته ایران — بقیه ریجن‌ها هیچ نامی از آن ندارند
  let shadEnabled = true;
  try {
    shadEnabled = (await getActiveCountryPublic()).modules.shad;
  } catch {
    /* دیفالت ایران */
  }
  // زبان سایت عمومی (کوکی بازدیدکننده؛ پیش‌فرض فارسی)
  let siteLang = "fa";
  try {
    siteLang = (await cookies()).get("bahar_site_lang")?.value?.trim() || "fa";
  } catch { /* دیفالت فارسی */ }
  const site = siteStringsFor(siteLang);
  return <Landing isLoggedIn={isLoggedIn} androidUrl={androidUrl} windowsUrl={windowsUrl} shadEnabled={shadEnabled} siteLang={site.code} siteDir={site.direction} siteStrings={site.siteStrings} siteLangs={SITE_LANGS} />;
}
