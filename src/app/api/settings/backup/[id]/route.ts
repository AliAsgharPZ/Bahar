import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, audit, ApiError, isDemoUser } from "@/lib/api";
import { readBackupFile, deleteBackupFile } from "@/lib/backup";
import { hasPermission } from "@/lib/roles";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/settings/backup/[id] — دانلود فایل بکاپ */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (me.role !== "SUPER_ADMIN" && !(me.role === "ADMIN" && hasPermission(me, "manage_backups"))) {
      throw new ApiError(403, "FORBIDDEN", "دسترسی مدیریت بکاپ ندارید.");
    }
    const { id } = await ctx.params;
    const record = await db.backup.findUnique({ where: { id } });
    if (!record) throw new ApiError(404, "NOT_FOUND", "رکورد بکاپ یافت نشد.");
    const content = await readBackupFile(record.filename).catch(() => {
      throw new ApiError(404, "FILE_MISSING", "فایل بکاپ روی دیسک یافت نشد.");
    });
    await audit({ user: me, action: "DOWNLOAD_BACKUP", entityType: "BACKUP", entityId: id });
    return new Response(content, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${record.filename}"`,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE /api/settings/backup/[id] — حذف نسخه پشتیبان */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    if (me.role !== "SUPER_ADMIN" && !(me.role === "ADMIN" && hasPermission(me, "manage_backups"))) {
      throw new ApiError(403, "FORBIDDEN", "دسترسی مدیریت بکاپ ندارید.");
    }
    const { id } = await ctx.params;
    const record = await db.backup.findUnique({ where: { id } });
    if (!record) throw new ApiError(404, "NOT_FOUND", "رکورد بکاپ یافت نشد.");
    await deleteBackupFile(record.filename).catch(() => {});
    await db.backup.delete({ where: { id } });
    await audit({ user: me, action: "DELETE_BACKUP", entityType: "BACKUP", entityId: id });
    return apiOk({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
