"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Fingerprint, Loader2, Plus, Trash2 } from "lucide-react";
import { useApi, apiDelete } from "@/lib/client";
import { formatDateFa } from "@/lib/persian";
import { passkeySupported, registerPasskey } from "@/lib/passkey-client";

type Key = { id: string; deviceLabel: string; createdAt: string; lastUsedAt: string | null };

/** کارت مدیریت Passkey در پروفایل — ساخت/فهرست/حذف کلیدهای عبور کاربر */
export function PasskeyCard() {
  const { data, refetch } = useApi<{ keys: Key[] }>("/api/auth/passkey/register");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const supported = passkeySupported();
  const keys = data?.keys ?? [];

  async function add() {
    setBusy(true);
    try {
      await registerPasskey(label.trim() || "Passkey");
      toast.success("کلید عبور ساخته شد — از این به بعد بدون رمز وارد می‌شوید.");
      setLabel("");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "ساخت کلید ناموفق بود.");
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/api/auth/passkey/register?id=${id}`);
      toast.success("کلید حذف شد.");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
  }

  return (
    <div className="b-card-md p-6 md:p-8">
      <h3 className="font-bold text-[15px] mb-2 flex items-center gap-2">
        <Fingerprint className="w-5 h-5 text-spring" /> کلید عبور (Passkey)
      </h3>
      <p className="t-sm text-steel mb-5">
        با اثر انگشت، چهره یا قفل دستگاهتان وارد شوید — بدون رمز عبور. کلید روی همین دستگاه می‌ماند و رمزتان هرگز جایی نمی‌رود.
      </p>
      {!supported && (
        <p className="text-[12.5px] text-warning-deep bg-warning/10 rounded-xl px-3 py-2 mb-4">
          این مرورگر/دستگاه از Passkey پشتیبانی نمی‌کند؛ با یک مرورگر به‌روز دوباره تلاش کنید.
        </p>
      )}
      <div className="flex flex-col gap-2 mb-4">
        {keys.length === 0 && <span className="text-[12.5px] text-steel">هنوز کلیدی نساخته‌اید.</span>}
        {keys.map((k) => (
          <div key={k.id} className="flex items-center gap-3 py-2 border-b border-hairline last:border-0">
            <Fingerprint className="w-4.5 h-4.5 text-spring shrink-0" />
            <span className="flex-1 min-w-0 text-[13px]">
              <b>{k.deviceLabel}</b>
              <span className="block text-[12px] text-steel">
                ساخته‌شده {formatDateFa(k.createdAt)}{k.lastUsedAt ? ` · آخرین ورود ${formatDateFa(k.lastUsedAt)}` : " · هنوز استفاده نشده"}
              </span>
            </span>
            <button className="text-stone hover:text-destructive" onClick={() => remove(k.id)} aria-label="حذف کلید">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 flex-wrap">
        <input className="b-input w-52" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="نام کلید (مثلاً: گوشی من)" />
        <button className="b-btn b-btn-spring" disabled={busy || !supported} onClick={add}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} ساخت کلید تازه
        </button>
      </div>
    </div>
  );
}
