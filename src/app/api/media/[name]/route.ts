import { NextRequest } from "next/server";
import { storageGet } from "@/lib/storage";
import path from "path";

type Ctx = { params: Promise<{ name: string }> };

const IMAGE_MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif", // FIX راند ۱۶: svg حذف شد — XSS هم‌مبدأ
};

const APP_MIME: Record<string, string> = {
  apk: "application/vnd.android.package-archive",
  exe: "application/vnd.microsoft.portable-executable",
  msi: "application/x-msdownload",
  zip: "application/zip",
};

/** GET /api/media/[name] — ارائه فایل رسانه/اپ آپلودشده */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { name } = await ctx.params;
    // جلوگیری از path traversal
    const safe = path.basename(name);
    if (!/^[a-zA-Z0-9._-]+$/.test(safe)) {
      return new Response("Bad request", { status: 400 });
    }
    const ext = safe.split(".").pop()?.toLowerCase() ?? "";

    const isApp = safe.startsWith("app-") && !!APP_MIME[ext];
    const mime = isApp ? APP_MIME[ext] : IMAGE_MIME[ext];
    if (!mime) return new Response("Not found", { status: 404 });

    // App installers (app-*) are distributed publicly on purpose. Everything
    // else is a user upload (profile photos, avatars) and requires a session —
    // the session cookie is same-site, so in-app <img> loads keep working.
    if (!isApp) {
      const { getSessionUser } = await import("@/lib/api");
      const me = await getSessionUser(req).catch(() => null);
      if (!me) return new Response("Unauthorized", { status: 401 });
    }

    const buffer = await storageGet(`uploads/${safe}`);
    if (!buffer) return new Response("Not found", { status: 404 });

    const headers: Record<string, string> = {
      "Content-Type": mime,
      // نصب‌کننده‌های اپ عمداً عمومی‌اند؛ آپلودهای کاربر نشست‌محورند و
      // نباید در کش‌های عمومی/مشترک بمانند.
      "Cache-Control": isApp ? "public, max-age=86400, immutable" : "private, max-age=3600",
    };
    if (isApp) {
      // فایل‌های اپ با ذخیره (دانلود) سرو می‌شوند
      headers["Content-Disposition"] = `attachment; filename="${safe}"`;
      headers["X-Content-Type-Options"] = "nosniff";
    }

    return new Response(new Uint8Array(buffer), { headers });
  } catch {
    return new Response("Error", { status: 500 });
  }
}
