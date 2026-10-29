import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, demoWriteBlock} from "@/lib/api";

// ============================================================
// بهار | نمایه‌های ذخیره‌شده (Saved Views)
// فیلترهای پرتکرار هر کاربر روی هر صفحه — ذخیره/بازیابی/حذف
// ============================================================

/** GET /api/saved-views?page=students */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const page = new URL(req.url).searchParams.get("page")?.trim() || "";
    const views = await db.savedView.findMany({
      where: { userId: me.id, ...(page ? { page } : {}) },
      orderBy: { updatedAt: "desc" },
      select: { id: true, page: true, name: true, config: true, createdAt: true, updatedAt: true },
    });
    return apiOk({ views });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/saved-views — ذخیره نمای فعلی { page, name, config(JSON string) } */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const body = await readJson<{ page?: string; name?: string; config?: string }>(req);
    const page = String(body.page ?? "").trim();
    const name = String(body.name ?? "").trim();
    if (!page || !name) return apiErr(400, "نام صفحه و نام نمایه الزامی است.", "BAD_INPUT");
    if (name.length > 40) return apiErr(400, "نام نمایه حداکثر ۴۰ نویسه است.", "BAD_NAME");
    if (page.length > 40) return apiErr(400, "شناسه صفحه نامعتبر است.", "BAD_PAGE");

    let config = "{}";
    if (body.config !== undefined) {
      try {
        const parsed = JSON.parse(String(body.config));
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("bad");
        config = JSON.stringify(parsed).slice(0, 4000);
      } catch {
        return apiErr(400, "پیکربندی نمایه نامعتبر است.", "BAD_CONFIG");
      }
    }

    const view = await db.savedView.upsert({
      where: { userId_page_name: { userId: me.id, page, name } },
      update: { config },
      create: { userId: me.id, page, name, config },
    });
    return apiOk({ view });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/saved-views?id= */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id")?.trim();
    if (!id) return apiErr(400, "شناسه نمایه الزامی است.", "BAD_INPUT");
    const view = await db.savedView.findUnique({ where: { id } });
    if (!view || view.userId !== me.id) return apiErr(404, "نمایه یافت نشد.", "NOT_FOUND");
    await db.savedView.delete({ where: { id } });
    return apiOk({ deleted: id });
  } catch (e) {
    return handleApiError(e);
  }
}
