import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { SwRegister } from "@/components/sw-register";
import { ThemeProvider } from "@/components/theme-provider";
import { SlowMoDebug } from "@/components/slowmo-debug";
import { ScrollbarFlare } from "@/components/scrollbar-flare";
import { getSettings } from "@/lib/settings";
import { getActiveCountryPublic } from "@/lib/country/server";
import { CountryProvider } from "@/lib/country/client";
import type { CountryProfile } from "@/lib/country/types";

export async function generateMetadata(): Promise<Metadata> {
  // فاوآیکون/عنوان سفارشی سوپرادمین (در صورت تنظیم)
  let faviconUrl = "";
  let siteTitle = "بهار";
  try {
    const s = await getSettings();
    faviconUrl = s.faviconUrl || "";
    siteTitle = s.siteTitle || "بهار";
  } catch { /* بانک در دسترس نیست — پیش‌فرض */ }
  // شاد فقط بسته ایران — در متای سایر ریجن‌ها هیچ نامی از آن نیست
  let shadEnabled = true;
  try {
    shadEnabled = (await getActiveCountryPublic()).modules.shad;
  } catch { /* دیفالت ایران */ }
  return {
    title: {
      default: `${siteTitle} | سامانه جامع مدیریت مدرسه`,
      template: `%s | ${siteTitle}`,
    },
    description: shadEnabled
      ? "سامانه یکپارچه مدیریت مدرسه بهار — وب، اندروید و ویندوز. مدیریت دانش‌آموزان، معلمان، کلاس‌ها، نمرات، حضور و غیاب، رویدادها و پیام‌رسان داخلی با دروازه شاد."
      : "سامانه یکپارچه مدیریت مدرسه بهار — وب، اندروید و ویندوز. مدیریت دانش‌آموزان، معلمان، کلاس‌ها، نمرات، حضور و غیاب، رویدادها و پیام‌رسان داخلی.",
    keywords: shadEnabled
      ? ["مدیریت مدرسه", "سامانه مدرسه", "بهار", "شاد", "نمرات", "حضور و غیاب"]
      : ["مدیریت مدرسه", "سامانه مدرسه", "بهار", "نمرات", "حضور و غیاب"],
    authors: [{ name: "بهار" }],
    manifest: "/manifest.json",
    icons: {
      icon: faviconUrl
        ? [{ url: faviconUrl }]
        : [
            { url: "/logo.svg", type: "image/svg+xml" },
            { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          ],
      apple: faviconUrl || "/icons/icon-180.png",
    },
    applicationName: siteTitle,
  };
}

export const viewport: Viewport = {
  themeColor: "#00825E",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // پروفایل کشور فعال از سرور — برای CountryProvider (بدون فلش رندر)
  let initialProfile: CountryProfile | null = null;
  try {
    initialProfile = await getActiveCountryPublic();
  } catch { /* دیفالت ایران */ }
  return (
    <html
      lang={initialProfile?.locale?.split("-")[0] ?? "fa"}
      dir={initialProfile?.direction ?? "rtl"}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <body className="antialiased bg-background text-foreground min-h-screen flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem enableColorScheme={false} disableTransitionOnChange>
          <CountryProvider initialProfile={initialProfile}>{children}</CountryProvider>
        </ThemeProvider>
        <Toaster position="top-center" richColors dir={initialProfile?.direction ?? "rtl"} />
        <SlowMoDebug />
        <ScrollbarFlare />
        <SwRegister />
      </body>
    </html>
  );
}
