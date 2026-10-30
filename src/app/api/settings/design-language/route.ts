import { NextRequest } from "next/server";
import { requireUser, apiOk, handleApiError, ApiError } from "@/lib/api";
import { DESIGN_LANGUAGE_DOC } from "@/lib/design-language-doc";

/** GET /api/settings/design-language — فایل زبان طراحی (فقط سوپرادمین، فقط خواندنی) */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (me.role !== "SUPER_ADMIN") {
      throw new ApiError(403, "FORBIDDEN", "این بخش فقط برای مدیر کل سامانه است.");
    }
    return apiOk({ markdown: DESIGN_LANGUAGE_DOC });
  } catch (e) {
    return handleApiError(e);
  }
}
