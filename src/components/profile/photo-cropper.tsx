"use client";

// ============================================================
// بهار | PhotoCropper — برش تصویر پروفایل با pan/zoom
// خروجی: مربع ۵۱۲×۵۱۲ (WebP یا JPEG) — نمایش نهایی دایره‌ای با CSS
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, Loader2, RotateCcw, Check, X, ZoomIn, ZoomOut } from "lucide-react";

const OUTPUT_SIZE = 512;
const MIN_SCALE = 1;
const MAX_SCALE = 5;

export function PhotoCropper({
  file,
  onCancel,
  onDone,
}: {
  file: File;
  onCancel: () => void;
  /** blob نهایی + ابعاد نمایش */
  onDone: (blob: Blob) => void;
}) {
  const [srcUrl, setSrcUrl] = useState<string | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // بارگذاری فایل
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrcUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!srcUrl) return;
    const el = new Image();
    el.onload = () => setImg(el);
    el.src = srcUrl;
  }, [srcUrl]);

  // بازنشانی موقعیت با بارگذاری تصویر جدید
  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [img]);

  const clampOffset = useCallback(
    (s: number, o: { x: number; y: number }) => {
      const vw = viewportRef.current?.clientWidth ?? 288;
      // نصف ابعاد نمایش‌داده‌شدهٔ تصویر در مقیاس فعلی
      const dw = img ? (img.width / Math.max(img.width, img.height)) * vw * s : 0;
      const dh = img ? (img.height / Math.max(img.width, img.height)) * vw * s : 0;
      const maxX = Math.max(0, (dw - vw) / 2);
      const maxY = Math.max(0, (dh - vw) / 2);
      return { x: Math.min(maxX, Math.max(-maxX, o.x)), y: Math.min(maxY, Math.max(-maxY, o.y)) };
    },
    [img],
  );

  function onPointerDown(e: React.PointerEvent) {
    if (!img) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDragging(true);
    dragStart.current = { px: e.clientX, py: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragging || !dragStart.current) return;
    setOffset(clampOffset(scale, {
      x: dragStart.current.ox + (e.clientX - dragStart.current.px),
      y: dragStart.current.oy + (e.clientY - dragStart.current.py),
    }));
  }
  function onPointerUp() {
    setDragging(false);
    dragStart.current = null;
  }

  function applyScale(next: number) {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, next));
    setScale(s);
    setOffset((o) => clampOffset(s, o));
  }

  // خروجی نهایی — برش مربعی ناحیهٔ دید
  async function exportCrop() {
    if (!img) return;
    setExporting(true);
    try {
      const vw = viewportRef.current?.clientWidth ?? 288;
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas");
      ctx.imageSmoothingQuality = "high";

      const base = Math.max(img.width, img.height);
      const dispW = (img.width / base) * vw * scale;
      const dispH = (img.height / base) * vw * scale;
      // موقعیت مرکز تصویر نسبت به گوشهٔ بالا-چپ viewport
      const cx = vw / 2 + offset.x;
      const cy = vw / 2 + offset.y;
      // نگاشت به مختصات اصلی تصویر
      const srcX = ((0 - (cx - dispW / 2)) / dispW) * img.width;
      const srcY = ((0 - (cy - dispH / 2)) / dispH) * img.height;
      const srcSize = (vw / dispW) * img.width;

      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/webp", 0.9),
      );
      if (blob && blob.type === "image/webp" && blob.size > 0) {
        onDone(blob);
      } else {
        // مرورگرهای بدون کدک WebP → JPEG
        const jpg = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
        );
        if (!jpg) throw new Error("encode");
        onDone(jpg);
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <b className="text-[14px] flex items-center gap-2">
          <Crop className="w-4 h-4 text-spring" /> برش تصویر پروفایل
        </b>
        <button type="button" className="b-btn b-btn-ghost !p-2 !min-h-9" onClick={onCancel} aria-label="بستن">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-4">
        {/* ناحیهٔ برش */}
        <div
          ref={viewportRef}
          className="relative w-72 h-72 rounded-full overflow-hidden bg-cloud touch-none select-none cursor-grab active:cursor-grabbing ring-4 ring-spring/25"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          role="application"
          aria-label="ناحیه برش تصویر — برای جابه‌جایی بکشید"
        >
          {img && (
             
            <img
              src={srcUrl ?? undefined}
              alt="پیش‌نمایش برش"
              draggable={false}
              className="absolute max-w-none"
              style={{
                width: (img.width / Math.max(img.width, img.height)) * 288 * scale,
                height: (img.height / Math.max(img.width, img.height)) * 288 * scale,
                left: "50%",
                top: "50%",
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px)`,
              }}
            />
          )}
          {/* حاشیهٔ راهنمای دایرهٔ برش */}
          <div className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_0_1.5px_rgba(255,255,255,0.85)]" />
        </div>

        {/* کنترل زوم */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <button type="button" className="b-btn b-btn-ghost !p-2 !min-h-9" onClick={() => applyScale(scale - 0.25)} aria-label="کوچک‌نمایی">
            <ZoomOut className="w-4 h-4" />
          </button>
          <input
            type="range"
            min={MIN_SCALE}
            max={MAX_SCALE}
            step={0.05}
            value={scale}
            onChange={(e) => applyScale(+e.target.value)}
            className="flex-1 accent-[var(--spring)]"
            aria-label="زوم"
          />
          <button type="button" className="b-btn b-btn-ghost !p-2 !min-h-9" onClick={() => applyScale(scale + 0.25)} aria-label="بزرگ‌نمایی">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button type="button" className="b-btn b-btn-ghost !p-2 !min-h-9" onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }); }} aria-label="بازنشانی" title="بازنشانی موقعیت">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <p className="t-sm text-steel text-center leading-relaxed">
          تصویر را بکشید تا در دایره جای بگیرد؛ با اسلایدر بزرگ‌نمایی کنید.
        </p>

        <div className="flex items-center gap-3 w-full">
          <button type="button" className="b-btn b-btn-spring flex-1" disabled={!img || exporting} onClick={exportCrop}>
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} تأیید و ادامه
          </button>
          <button type="button" className="b-btn b-btn-ghost" onClick={onCancel}>انصراف</button>
        </div>
      </div>
    </div>
  );
}
