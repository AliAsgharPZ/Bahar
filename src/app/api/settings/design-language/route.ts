import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";
import { requireUser, apiOk, handleApiError, ApiError } from "@/lib/api";

/** GET /api/settings/design-language — فایل زبان طراحی (فقط سوپرادمین، فقط خواندنی) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "این بخش فقط برای مدیر کل سامانه است.");
    }
    const content = await fs.readFile(
      path.join(process.cwd(), "docs", "design-language.md"),
      "utf8"
    ).catch(() => {
      throw new ApiError(404, "NOT_FOUND", "فایل زبان طراحی یافت نشد.");
    });
    return apiOk({ markdown: content });
  } catch (e) {
    return handleApiError(e);
  }
}
