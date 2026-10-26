"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/** بهار | تم روشن/تاریک — پیش‌فرض پیروی خودکار از سیستم */
export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
