"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, CheckCircle2, Link2, Share2, Building2, Check } from "lucide-react";
import { enDigits } from "@/lib/persian";

/** فرم تماس/درخواست دمو + دکمه‌های کپی/اشتراک لینک صفحه */
export function ContactDemo() {
  const [form, setForm] = useState({ name: "", phone: "", schoolName: "", city: "", kind: "PURCHASE", message: "" });
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch("/api/public/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "خطا");
      setDone(json.ticketCode ?? "OK");
      toast.success("درخواست شما ثبت شد؛ به‌زودی تماس می‌گیریم.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSending(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast.success("لینک صفحه کپی شد — برای مدیر مدرسه بفرستید!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("کپی نشد؛ آدرس را دستی کپی کنید.");
    }
  }

  async function shareLink() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "سامانه مدیریت مدارس بهار",
          text: "برای مدیریت مدرسه‌مان این سامانه را ببینید:",
          url: window.location.href,
        });
      } catch {
        /* لغو */
      }
    } else {
      copyLink();
    }
  }

  if (done) {
    return (
      <div className="b-card !rounded-3xl p-8 text-center flex flex-col items-center">
        <CheckCircle2 className="w-14 h-14 text-spring mb-4" />
        <b className="text-[16px] block mb-1">درخواست شما ثبت شد</b>
        <p className="text-[13px] text-steel leading-relaxed mb-3">
          کد پیگیری: <b dir="ltr" className="font-mono">{done}</b> — تیم فروش بهار به‌زودی با شما تماس می‌گیرد.
        </p>
        <div className="flex items-center gap-2 flex-wrap justify-center mt-3">
          <button className="b-btn b-btn-soft b-btn-sm" onClick={copyLink}>
            {copied ? <><Check className="w-3.5 h-3.5" /> کپی شد</> : <><Link2 className="w-3.5 h-3.5" /> کپی لینک این صفحه</>}
          </button>
          <button className="b-btn b-btn-soft b-btn-sm" onClick={shareLink}>
            <Share2 className="w-3.5 h-3.5" /> اشتراک‌گذاری صفحه
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="b-card !rounded-3xl p-6 md:p-8">
      <h2 className="text-[20px] font-extrabold mb-2 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-spring" /> این صفحه را به مدیر مدرسه معرفی کنید
      </h2>
      <p className="text-[13px] text-steel leading-relaxed mb-5">
        لینک صفحه را برای مدیر مدرسه‌تان بفرستید یا فرم را برای دریافت مشاوره و راه‌اندازی تکمیل کنید.
      </p>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button className="b-btn b-btn-soft b-btn-sm" onClick={copyLink}>
          {copied ? <><Check className="w-3.5 h-3.5" /> کپی شد</> : <><Link2 className="w-3.5 h-3.5" /> کپی لینک صفحه</>}
        </button>
        <button className="b-btn b-btn-soft b-btn-sm" onClick={shareLink}>
          <Share2 className="w-3.5 h-3.5" /> اشتراک‌گذاری
        </button>
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3.5">
        <div className="grid sm:grid-cols-2 gap-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نام شما *</span>
            <input className="b-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">موبایل *</span>
            <input className="b-input" dir="ltr" inputMode="numeric" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: enDigits(e.target.value) }))} required placeholder="09…" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">نام مدرسه</span>
            <input className="b-input" value={form.schoolName} onChange={(e) => setForm((f) => ({ ...f, schoolName: e.target.value }))} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold">شهر</span>
            <input className="b-input" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold">نوع درخواست</span>
          <div className="flex gap-2 flex-wrap">
            {[
              { v: "PURCHASE", l: "خرید و راه‌اندازی" },
              { v: "DEMO", l: "دموی رایگان" },
              { v: "QUESTION", l: "پرسش" },
            ].map((k) => (
              <button key={k.v} type="button" className={`b-pill-tab ${form.kind === k.v ? "b-pill-tab-active" : ""}`} onClick={() => setForm((f) => ({ ...f, kind: k.v }))}>
                {k.l}
              </button>
            ))}
          </div>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold">توضیحات</span>
          <textarea rows={3} className="b-input !rounded-2xl resize-none" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="تعداد دانش‌آموز، نیازهای خاص مدرسه…" />
        </label>
        <button type="submit" disabled={sending} className="b-btn b-btn-spring">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />}
          {form.kind === "DEMO" ? "درخواست دموی رایگان" : form.kind === "PURCHASE" ? "درخواست مشاوره خرید" : "ارسال پرسش"}
        </button>
      </form>
    </div>
  );
}
