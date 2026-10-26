import { NextRequest } from "next/server";
import { requireUser, apiOk, handleApiError } from "@/lib/api";
import { getAvatarOptions, avatarOptionsIsLive } from "@/lib/avatar-options";

// ============================================================
// GET /api/profile/avatar-options — گزینه‌های معتبر آواتار Personas
// کش‌شده در سرور (۱ ساعت)؛ کلاینت‌ها مستقیماً به Draftbit وصل نمی‌شوند.
// ============================================================

export async function GET(req: NextRequest) {
  try {
    await requireUser(req);
    const options = await getAvatarOptions();
    return apiOk({ options, live: avatarOptionsIsLive() });
  } catch (e) {
    return handleApiError(e);
  }
}
