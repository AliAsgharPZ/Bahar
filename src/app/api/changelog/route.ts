import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiOk, handleApiError } from "@/lib/api";

/** GET /api/changelog — تغییرات سرویس بهار (عمومی) */
export async function GET(_req: NextRequest) {
  try {
    const entries = await db.changelogEntry.findMany({
      orderBy: { publishedAt: "desc" },
      take: 30,
    });
    return apiOk({ entries });
  } catch (e) {
    return handleApiError(e);
  }
}
