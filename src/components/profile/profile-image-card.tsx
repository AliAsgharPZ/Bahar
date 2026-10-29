"use client";

// ============================================================
// بهار | کارت «تصویر پروفایل» — صفحهٔ پروفایل
// دو مسیر: آپلود عکس (با برش) و ساخت آواتار Personas
// + بازیابی انتخاب قبلی + حذف تصویر
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Palette, Trash2, Loader2, ImageIcon, RefreshCcw, Check } from "lucide-react";
import { useApi, apiPut, apiDelete } from "@/lib/client";
import { UserAvatar } from "@/components/shared/user-avatar";
import { PhotoCropper } from "@/components/profile/photo-cropper";
import { AvatarBuilder } from "@/components/profile/avatar-builder";
import {
  type AvatarOptions,
  type AvatarParams,
  defaultAvatarFor,
} from "@/lib/avatar";

type ProfileImageState = {
  profileImageType: "upload" | "avatar" | null;
  upload: { url: string } | null;
  avatar: AvatarParams | null;
};

const MAX_UPLOAD = 4 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfileImageCard({
  me,
  onChanged,
}: {
  me: { id: string; firstName: string; lastName: string };
  /** اطلاع به صفحه برای رفرش داده‌های کاربر (مثلاً کارت هویت) */
  onChanged?: () => void;
}) {
  const router = useRouter();
  const { data: state, loading, refetch } = useApi<ProfileImageState>("/api/profile/image");
  const { data: optionsData } = useApi<{ options: AvatarOptions }>("/api/profile/avatar-options");

  const [mode, setMode] = useState<"idle" | "crop" | "builder">("idle");
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [switching, setSwitching] = useState<"upload" | "avatar" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  // فایل انتخاب‌شده → اعتبارسنجی کلاینت → کراپر
  function onPickFile(f: File | null) {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      toast.error("فقط تصویر JPG، PNG یا WebP مجاز است.");
      return;
    }
    if (f.size > MAX_UPLOAD) {
      toast.error("حجم تصویر بیش از ۴ مگابایت است.");
      return;
    }
    setPickedFile(f);
    setMode("crop");
  }

  // آپلود blob برش‌خورده (FormData خام — بدون هدر JSON)
  async function uploadCropped(blob: Blob) {
    setUploading(true);
    try {
      const fd = new FormData();
      const ext = blob.type === "image/webp" ? "webp" : "jpg";
      fd.append("file", new File([blob], `profile.${ext}`, { type: blob.type }));
      const res = await fetch("/api/profile/image", { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "خطا در آپلود");
      }
      toast.success("تصویر پروفایل ذخیره شد.");
      setMode("idle");
      setPickedFile(null);
      await refetch();
      onChanged?.();
      router.refresh(); // به‌روزرسانی آواتار در سایدبار و کل برنامه
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در آپلود");
    } finally {
      setUploading(false);
    }
  }

  // ذخیرهٔ پیکربندی آواتار
  async function saveAvatar(params: AvatarParams) {
    setSavingAvatar(true);
    try {
      await apiPut("/api/profile/image", { type: "avatar", avatar: params });
      toast.success("آواتار ذخیره شد.");
      setMode("idle");
      await refetch();
      onChanged?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ذخیره آواتار");
    } finally {
      setSavingAvatar(false);
    }
  }

  // فعال‌سازی مجدد اسلات ذخیره‌شدهٔ قبلی
  async function activate(type: "upload" | "avatar") {
    setSwitching(type);
    try {
      await apiPut("/api/profile/image", { type });
      toast.success(type === "upload" ? "عکس آپلودشده فعال شد." : "آواتار قبلی فعال شد.");
      await refetch();
      onChanged?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSwitching(null);
    }
  }

  // حذف کامل تصویر پروفایل
  async function removeImage() {
    setConfirmDelete(false);
    setSwitching("upload");
    try {
      await apiDelete("/api/profile/image");
      toast.success("تصویر پروفایل حذف شد؛ آواتار پیش‌فرض فعال است.");
      await refetch();
      onChanged?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در حذف");
    } finally {
      setSwitching(null);
    }
  }

  // نمایش فعلی
  const displayUser = {
    id: me.id,
    firstName: me.firstName,
    lastName: me.lastName,
    profileImageType: state?.profileImageType ?? null,
    photoUrl: state?.profileImageType === "upload" ? state.upload?.url ?? null : null,
    avatar: state?.profileImageType === "avatar" ? state.avatar : null,
  };

  const hasCustom = !!state?.profileImageType;
  const inactiveUpload = state?.profileImageType === "avatar" && state.upload ? state.upload : null;
  const inactiveAvatar = state?.profileImageType === "upload" && state.avatar ? state.avatar : null;

  // بستن حالت‌ها با Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && mode === "builder" && !savingAvatar) setMode("idle");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, savingAvatar]);

  const busy = uploading || !!switching;

  return (
    <div className="b-card-md p-6 md:p-8">
      <h3 className="font-bold text-[16px] mb-1 flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-spring" /> تصویر پروفایل
      </h3>
      <p className="t-sm text-steel mb-5">
        یک عکس واقعی آپلود کنید یا آواتار اختصاصی خود را بسازید — در همه‌جا (سایدبار، گفتگوها، کاربران و…) نمایش داده می‌شود.
      </p>

      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* پیش‌نمایش تصویر فعلی */}
        <div className="flex items-center gap-4">
          {loading ? (
            <span className="w-24 h-24 rounded-full bg-cloud animate-pulse shrink-0" />
          ) : (
            <UserAvatar user={displayUser} size={96} className="ring-4 ring-spring-tint" />
          )}
          <div className="flex flex-col gap-1 md:hidden">
            <b className="text-[14px]">{me.firstName} {me.lastName}</b>
            <span className="text-[12px] text-steel">
              {state?.profileImageType === "upload" ? "عکس آپلودشده" : state?.profileImageType === "avatar" ? "آواتار اختصاصی" : "آواتار پیش‌فرض"}
            </span>
          </div>
        </div>

        {/* اکشن‌های اصلی */}
        <div className="flex flex-col gap-3 md:border-s md:border-hairline-soft md:ps-6 md:flex-1">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="b-btn b-btn-spring"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />} آپلود عکس
            </button>
            <button
              type="button"
              className="b-btn b-btn-ghost"
              disabled={busy || !optionsData}
              onClick={() => setMode(mode === "builder" ? "idle" : "builder")}
            >
              <Palette className="w-4 h-4" /> ساخت آواتار
            </button>
            {hasCustom && (
              <button
                type="button"
                className="b-btn b-btn-ghost !text-destructive hover:!bg-destructive/10"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                {switching && !savingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} حذف تصویر
              </button>
            )}
          </div>

          {/* بازیابی انتخاب قبلی — اسلات غیرفعال */}
          {(inactiveUpload || inactiveAvatar) && (
            <div className="flex flex-wrap items-center gap-2 text-[12px] text-steel">
              {inactiveUpload && (
                <button
                  type="button"
                  className="b-btn b-btn-ghost !py-1.5 !text-[12px]"
                  disabled={busy}
                  onClick={() => activate("upload")}
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> بازگشت به عکس آپلودشدهٔ قبلی
                </button>
              )}
              {inactiveAvatar && (
                <button
                  type="button"
                  className="b-btn b-btn-ghost !py-1.5 !text-[12px]"
                  disabled={busy}
                  onClick={() => activate("avatar")}
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> بازگشت به آواتار قبلی
                </button>
              )}
            </div>
          )}

          <p className="text-[12px] text-stone leading-relaxed">
            JPG، PNG یا WebP تا ۴ مگابایت — برش دایره‌ای خودکار انجام می‌شود. با ساخت آواتار، عکس قبلی‌تان حذف نمی‌شود و هر وقت بخواهید قابل بازگشت است.
          </p>
        </div>
      </div>

      {/* ورودی مخفی فایل */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          onPickFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      {/* ───── برش عکس ───── */}
      {mode === "crop" && pickedFile && (
        <div className="mt-6 pt-6 border-t border-hairline-soft">
          {uploading ? (
            <div className="flex flex-col items-center gap-3 py-10">
              <Loader2 className="w-8 h-8 text-spring animate-spin" />
              <span className="t-sm text-steel">در حال آپلود تصویر…</span>
            </div>
          ) : (
            <PhotoCropper
              file={pickedFile}
              onCancel={() => { setMode("idle"); setPickedFile(null); }}
              onDone={uploadCropped}
            />
          )}
        </div>
      )}

      {/* ───── سازندهٔ آواتار: دسکتاپ داخل کارت / موبایل تمام‌صفحه ───── */}
      {mode === "builder" && optionsData && (
        <div className="fixed inset-0 z-50 bg-background overflow-y-auto p-4 md:static md:z-auto md:bg-transparent md:overflow-visible md:p-0 md:mt-6 md:pt-6 md:border-t md:border-hairline-soft">
          <div className="b-card-sm !rounded-2xl bg-background md:bg-transparent md:border-0 md:shadow-none max-w-2xl mx-auto md:mx-0">
            <AvatarBuilder
              initial={state?.avatar ?? defaultAvatarFor(me.id)}
              options={optionsData.options}
              saving={savingAvatar}
              onSave={saveAvatar}
              onCancel={() => setMode("idle")}
            />
          </div>
        </div>
      )}

      {/* تأیید حذف */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setConfirmDelete(false)} aria-hidden />
          <div className="relative b-card p-6 w-full max-w-sm b-pop">
            <b className="block mb-2">حذف تصویر پروفایل</b>
            <p className="t-sm text-steel mb-5 leading-relaxed">
              عکس و آواتار اختصاصی هر دو حذف می‌شوند و آواتار پیش‌فرض سیستم برای شما ساخته می‌شود. مطمئنید؟
            </p>
            <div className="flex items-center gap-3">
              <button type="button" className="b-btn b-btn-ghost !text-destructive" onClick={removeImage}>
                <Check className="w-4 h-4" /> بله، حذف کن
              </button>
              <button type="button" className="b-btn b-btn-ghost" onClick={() => setConfirmDelete(false)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
