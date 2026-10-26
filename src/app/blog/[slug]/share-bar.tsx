"use client";

import { toast } from "sonner";
import { Link2, Share2, Check } from "lucide-react";
import { useState } from "react";

/** دکمه اشتراک‌گذاری — کپی لینک + وب‌شیر بومی */
export function ShareBar({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const full = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      toast.success("لینک کپی شد.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("کپی نشد — لینک را دستی کپی کنید.");
    }
  }

  async function share() {
    const full = `${window.location.origin}${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, url: full });
      } catch {
        /* لغو شده */
      }
    } else {
      copy();
    }
  }

  return (
    <div className="b-card-sm !rounded-2xl p-4 flex flex-wrap items-center gap-3 mb-8">
      <b className="text-[12.5px]">اشتراک‌گذاری این نوشته:</b>
      <button className="b-btn b-btn-soft b-btn-sm" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? "کپی شد" : "کپی لینک"}
      </button>
      <button className="b-btn b-btn-soft b-btn-sm" onClick={share}>
        <Share2 className="w-3.5 h-3.5" /> اشتراک‌گذاری
      </button>
    </div>
  );
}
