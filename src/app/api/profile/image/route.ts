import { NextRequest } from "next/server";
import path from "path";
import crypto from "crypto";
import { db } from "@/lib/db";
import { requireUser, apiOk, handleApiError, audit, ApiError , isDemoUser, apiErr, rateLimit } from "@/lib/api";
import { parseAvatarConfig, sanitizeAvatarParams, type AvatarParams } from "@/lib/avatar";
import { getAvatarOptions } from "@/lib/avatar-options";
import { storagePut, storageDelete } from "@/lib/storage";

// ============================================================
// تصویر پروفایل کاربر — آپلود عکس / پیکربندی آواتار Personas
// امنیت: فقط حساب خود کاربر + validation فایل (magic bytes) + whitelist آواتار
// ============================================================

const MAX_SIZE = 4 * 1024 * 1024; // ۴ مگابایت

/** تشخیص نوع واقعی فایل از بایت‌های آغازین (نه MIME ادعایی کلاینت) */
function sniffImageType(buf: Buffer): "jpg" | "png" | "webp" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return "webp";
  return null;
}

/** حذف امن فایل قبلی از db/uploads (فقط نام سادهٔ داخلی) */
async function removeUploadedFile(url: string | null | undefined) {
  if (!url || !url.startsWith("/api/media/")) return;
  const name = path.basename(url);
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return;
  await storageDelete(`uploads/${name}`);
}

/** وضعیت فعلی تصویر پروفایل — هر دو اسلات ذخیره‌شده + نوع فعال */
async function currentState(userId: string) {
  const u = await db.user.findUnique({
    where: { id: userId },
    select: { profileImageType: true, photoUrl: true, avatarConfig: true },
  });
  const type = u && (u.profileImageType === "upload" || u.profileImageType === "avatar") ? u.profileImageType : null;
  return {
    profileImageType: type,
    upload: u?.photoUrl ? { url: u.photoUrl } : null,
    avatar: parseAvatarConfig(u?.avatarConfig),
  };
}

/** GET — وضعیت فعلی تصویر پروفایل خود کاربر */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (!rateLimit(`pimg:${me.id}`, 10, 60000)) {
      return apiErr(429, "بارگذاری تصاویر پی‌درپی؛ کمی صبر کنید.", "RATE_LIMITED");
    }
    return apiOk(await currentState(me.id));
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST — آپلود عکس پروفایل (multipart) — تصویر قبلی کاربر جایگزین می‌شود؛ آواتار ذخیره‌شده حفظ می‌شود */
export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");

    const form = await req.formData().catch(() => null);
    if (!form) throw new ApiError(400, "BAD_FORM", "فایل ارسال نشد.");
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "NO_FILE", "فایلی یافت نشد.");
    if (file.size > MAX_SIZE) throw new ApiError(413, "TOO_LARGE", "حجم تصویر بیش از ۴ مگابایت است.");
    if (file.size < 1024) throw new ApiError(400, "TOO_SMALL", "فایل تصویر معتبر نیست.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = sniffImageType(buffer);
    if (!kind) throw new ApiError(415, "BAD_TYPE", "فقط تصویر JPG، PNG یا WebP مجاز است.");

    const prev = await db.user.findUnique({
      where: { id: me.id },
      select: { photoUrl: true },
    });

    const name = `pfp-${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${kind}`;
    await storagePut(`uploads/${name}`, buffer);

    const url = `/api/media/${name}`;
    await db.user.update({
      where: { id: me.id },
      data: { photoUrl: url, profileImageType: "upload" },
    });

    // حذف فایل قبلی (اگر آدرس داخلی خودمان است)
    if (prev?.photoUrl && prev.photoUrl !== url) await removeUploadedFile(prev.photoUrl);

    await audit({
      user: me, action: "PROFILE_IMAGE_UPLOAD", entityType: "USER", entityId: me.id,
      meta: { file: name, size: file.size, kind },
    });

    return apiOk(await currentState(me.id));
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT — تغییر نوع تصویر فعال یا ذخیرهٔ پیکربندی آواتار */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const body = await req.json().catch(() => null) as { type?: string; avatar?: unknown } | null;
    if (!body || typeof body.type !== "string") throw new ApiError(400, "BAD_BODY", "درخواست نامعتبر است.");

    const u = await db.user.findUnique({
      where: { id: me.id },
      select: { photoUrl: true, avatarConfig: true },
    });

    if (body.type === "upload") {
      // فعال‌سازی عکس آپلودشدهٔ قبلی — بدون ورودی URL از کلاینت (فقط مقدار ذخیره‌شده در DB)
      if (!u?.photoUrl) throw new ApiError(400, "NO_PHOTO", "عکس آپلودشده‌ای برای فعال‌سازی وجود ندارد.");
      await db.user.update({ where: { id: me.id }, data: { profileImageType: "upload" } });
    } else if (body.type === "avatar") {
      // ذخیرهٔ پیکربندی آواتار — هر ۱۳ پارامتر نسبت به گزینه‌های معتبر API پاک‌سازی می‌شود
      const options = await getAvatarOptions();
      let params: AvatarParams | null = null;
      if (body.avatar) {
        params = sanitizeAvatarParams(body.avatar, options);
        if (!params) throw new ApiError(422, "BAD_AVATAR", "پیکربندی آواتار معتبر نیست.");
      } else if (u?.avatarConfig) {
        // بدون بدنه → فقط فعال‌سازی آواتار ذخیره‌شدهٔ قبلی
        params = parseAvatarConfig(u.avatarConfig, options);
        if (!params) throw new ApiError(400, "NO_AVATAR", "آواتار ذخیره‌شده‌ای برای فعال‌سازی وجود ندارد.");
      } else {
        throw new ApiError(400, "NO_AVATAR", "پیکربندی آواتار ارسال نشد.");
      }
      await db.user.update({
        where: { id: me.id },
        data: { avatarConfig: JSON.stringify(params), profileImageType: "avatar" },
      });
    } else {
      throw new ApiError(400, "BAD_TYPE", "نوع تصویر باید upload یا avatar باشد.");
    }

    await audit({
      user: me, action: "PROFILE_IMAGE_SET", entityType: "USER", entityId: me.id,
      meta: { type: body.type },
    });

    return apiOk(await currentState(me.id));
  } catch (e) {
    return handleApiError(e);
  }
}

/** DELETE — حذف کامل تصویر پروفایل (عکس + آواتار) و بازگشت به آواتار پیش‌فرض */
export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const u = await db.user.findUnique({
      where: { id: me.id },
      select: { photoUrl: true },
    });

    await db.user.update({
      where: { id: me.id },
      data: { profileImageType: null, photoUrl: null, avatarConfig: null },
    });
    if (u?.photoUrl) await removeUploadedFile(u.photoUrl);

    await audit({
      user: me, action: "PROFILE_IMAGE_DELETE", entityType: "USER", entityId: me.id,
    });

    return apiOk(await currentState(me.id));
  } catch (e) {
    return handleApiError(e);
  }
}
