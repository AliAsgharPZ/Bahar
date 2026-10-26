"use client";

// ============================================================
// بهار | UserAvatar — نمایش یکدست تصویر کاربر در کل برنامه
// اولویت: عکس آپلودشده ← آواتار Personas ← آواتار پیش‌فرض قطعی (بر اساس شناسه کاربر)
// ============================================================

import { useState } from "react";
import {
  buildAvatarUrl,
  defaultAvatarFor,
  type AvatarUserInput,
} from "@/lib/avatar";

export function UserAvatar({
  user,
  size = 40,
  className = "",
  rounded = "full",
}: {
  user: AvatarUserInput;
  /** قطر به پیکسل */
  size?: number;
  className?: string;
  /** شکل ظاهری — دایره (پیش‌فرض) یا گوشه‌گرد */
  rounded?: "full" | "xl";
}) {
  const [failed, setFailed] = useState(false);

  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  const initials = `${user.firstName?.[0] ?? "ب"}${user.lastName?.[0] ?? "ه"}`;

  // انتخاب منبع تصویر بر اساس نوع فعال
  let src: string | null = null;
  if (!failed) {
    if (user.profileImageType === "upload" && user.photoUrl) {
      src = user.photoUrl;
    } else if (user.profileImageType === "avatar" && user.avatar) {
      src = buildAvatarUrl(user.avatar, size * 2);
    } else {
      // آواتار پیش‌فرض قطعی — بدون ذخیره در DB، محاسبه‌شده از شناسه کاربر
      src = buildAvatarUrl(defaultAvatarFor(user.id), size * 2);
    }
  }

  const radiusCls = rounded === "full" ? "rounded-full" : "rounded-2xl";

  return (
    <span
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-spring text-primary-foreground font-bold select-none ${radiusCls} ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      title={name || undefined}
      aria-label={name || "کاربر"}
      role="img"
    >
      {src ? (
         
        <img
          src={src}
          alt={name || "تصویر پروفایل"}
          width={size}
          height={size}
          loading="lazy"
          draggable={false}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
