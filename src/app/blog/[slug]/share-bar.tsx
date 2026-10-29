"use client";

import { toast } from "sonner";
import { Link2, Share2, Check } from "lucide-react";
import { useState } from "react";

/** دکمه اشتراک‌گذاری — کپی لینک + وب‌شیر بومی */
export type ShareTexts = { heading: string; copied: string; copyLink: string; share: string; linkCopied: string; linkCopyFailed: string };
export function ShareBar({ url, title, texts }: { url: string; title: string; texts?: ShareTexts }) {
  const t = texts ?? { heading: "اشتراک‌گذاری این نوشته:", copied: "کپی شد", copyLink: "کپی لینک", share: "اشتراک‌گذاری", linkCopied: "لینک کپی شد.", linkCopyFailed: "کپی نشد — لینک را دستی کپی کنید." };
  const [copied, setCopied] = useState(false);

  async function copy() {
    const full = `${window.location.origin}${url}`;
    try {
      await navigator.clipboard.writeText(full);
      setCopied(true);
      toast.success(t.linkCopied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t.linkCopyFailed);
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
      <b className="text-[12.5px]">{t.heading}</b>
      <button className="b-btn b-btn-soft b-btn-sm" onClick={copy}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
        {copied ? t.copied : t.copyLink}
      </button>
      <button className="b-btn b-btn-soft b-btn-sm" onClick={share}>
        <Share2 className="w-3.5 h-3.5" /> {t.share}
      </button>
    </div>
  );
}
