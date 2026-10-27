import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, ApiError, isDemoUser } from "@/lib/api";
import { ROLE_LABELS, hasPermission } from "@/lib/roles";

// ============================================================
// درخواست تغییر مشخصات توسط خود کاربر → تایید بالادستی
// دانش‌آموز/ولی/معاون/معلم → مدیر مدرسه؛ مدیر → ادمین سرویس
// ============================================================

/** فیلدهایی که کاربر می‌تواند درخواست تغییر بدهد */
export const SELF_EDITABLE_FIELDS = [
  "firstName", "lastName", "fatherName", "gender", "birthPlace", "birthDate",
  "phone", "homePhone", "email", "address", "postalCode", "shadNumber",
  "education", "fieldOfStudy", "jobTitle", "photoUrl",
] as const;
type SelfField = (typeof SELF_EDITABLE_FIELDS)[number];

/** GET /api/profile-requests — خودم: وضعیت درخواست‌هایم؛ بالادستی: صف تایید */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const scope = new URL(req.url).searchParams.get("scope") ?? "auto";

    // ── صف تایید برای بالادستی ──
    if (scope === "inbox") {
      const isSuper = me.role === "SUPER_ADMIN";
      const isAdmin = me.role === "ADMIN" && hasPermission(me, "view_users"); // FIX راند ۱۶
      let where: Record<string, unknown> = { status: "PENDING" };
      if (me.role === "MANAGER" && me.schoolId) {
        where = { status: "PENDING", user: { schoolId: me.schoolId, role: { in: ["DEPUTY", "TEACHER", "STUDENT", "PARENT"] } } };
      } else if (isSuper || isAdmin) {
        // ادمین‌ها: درخواست‌های مدیران مدارس
        where = { status: "PENDING", user: { role: "MANAGER" } };
      } else {
        throw new ApiError(403, "FORBIDDEN", "دسترسی مشاهده صف تایید ندارید.");
      }
      const rows = await db.profileChangeRequest.findMany({
        where,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, role: true, nationalId: true, schoolId: true, school: { select: { name: true } } } },
        },
        orderBy: { createdAt: "asc" },
        take: 100,
      });
      return apiOk({
        requests: rows.map((r) => ({
          ...r,
          changes: JSON.parse(r.changes),
          roleLabel: ROLE_LABELS[r.user.role] ?? r.user.role,
        })),
      });
    }

    // ── درخواست‌های خود کاربر ──
    const mine = await db.profileChangeRequest.findMany({
      where: { userId: me.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    const stats = {
      pending: mine.filter((m) => m.status === "PENDING").length,
      approved: mine.filter((m) => m.status === "APPROVED").length,
      rejected: mine.filter((m) => m.status === "REJECTED").length,
    };
    return apiOk({
      requests: mine.map((r) => ({
        ...r,
        changes: JSON.parse(r.changes),
        reviewedByName: null,
      })),
      editableFields: SELF_EDITABLE_FIELDS,
      stats,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/profile-requests — ثبت درخواست تغییر مشخصات خودم */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await readJson<{ changes?: Record<string, string>; reason?: string }>(req);
    if (!body.changes || typeof body.changes !== "object") {
      throw new ApiError(400, "BAD_CHANGES", "تغییری ارسال نشده است.");
    }

    const user = await db.user.findUnique({ where: { id: me.id } });
    if (!user) throw new ApiError(404, "NOT_FOUND", "کاربر یافت نشد.");
    if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
      throw new ApiError(400, "NO_REVIEW_NEEDED", "ادمین‌های سرویس مستقیم از صفحه پروفایل ویرایش می‌کنند.");
    }

    // درخواست باز قبلی؟ — جایگزین شود
    const open = await db.profileChangeRequest.findFirst({
      where: { userId: me.id, status: "PENDING" },
    });

    const diffs: Record<string, { from: string | null; to: string }> = {};
    for (const [field, newValue] of Object.entries(body.changes)) {
      if (!SELF_EDITABLE_FIELDS.includes(field as SelfField)) continue;
      const to = String(newValue ?? "").trim();
      const from = (user as unknown as Record<string, unknown>)[field];
      const fromStr = from instanceof Date ? from.toISOString().slice(0, 10) : (from ? String(from) : null);
      if (to !== (fromStr ?? "")) {
        if (!to && fromStr) {
          diffs[field] = { from: fromStr, to: "" };
        } else if (to) {
          diffs[field] = { from: fromStr, to };
        }
      }
    }
    if (Object.keys(diffs).length === 0) {
      throw new ApiError(400, "NO_CHANGE", "تغییری یافت نشد؛ مقادیر فعلی را ویرایش کنید.");
    }

    const payload = {
      userId: me.id,
      changes: JSON.stringify(diffs),
      reason: body.reason ? String(body.reason).slice(0, 300) : null,
      status: "PENDING",
    };

    let request;
    if (open) {
      request = await db.profileChangeRequest.update({ where: { id: open.id }, data: payload });
    } else {
      request = await db.profileChangeRequest.create({ data: payload });
    }

    await audit({
      user: me, action: "REQUEST_PROFILE_CHANGE", entityType: "PROFILE_CHANGE_REQUEST",
      entityId: request.id, meta: { fields: Object.keys(diffs) },
      schoolId: me.schoolId,
    });

    const approver = me.role === "MANAGER" ? "ادمین سرویس" : "مدیر مدرسه";
    return apiOk({ ok: true, request: { id: request.id }, approver });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.profileChangeRequest.findUnique({ where: { id }, select: { userId: true } });
    if (!row) return apiErr(404, "درخواست یافت نشد.", "NOT_FOUND");
    if (row.userId !== me.id && !["MANAGER", "SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.profileChangeRequest.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
