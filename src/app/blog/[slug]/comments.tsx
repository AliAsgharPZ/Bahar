"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, UserRound, Check } from "lucide-react";
import { relativeTimeFa, enDigits } from "@/lib/persian";

/** فهرست نظرات تاییدشده */
export function CommentsList({ comments, firstComment }: { comments: Array<{ name: string; body: string; createdAt: string }>; firstComment?: string }) {
  if (comments.length === 0) {
    return <p className="text-[12px] text-steel">{firstComment ?? "اولین نظر را شما بنویسید."}</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {comments.map((c, i) => (
        <div key={i} className="b-card-sm !rounded-2xl p-4 flex items-start gap-3">
          <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
            <UserRound className="w-4 h-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <b className="text-[12px]">{c.name}</b>
              <span className="text-[12px] text-stone">{relativeTimeFa(c.createdAt)}</span>
            </div>
            <p className="text-[12px] text-ink/80 leading-relaxed whitespace-pre-line">{c.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/** فرم ثبت نظر (عمومی — در انتظار تایید) */
export type CommentFormTexts = { done: string; toastDone: string; error: string; namePlaceholder: string; bodyPlaceholder: string; submit: string };
export function CommentForm({ slug, texts }: { slug: string; texts?: CommentFormTexts }) {
  const t = texts ?? { done: "نظر شما ثبت شد", toastDone: "نظر شما ثبت شد و پس از تایید نمایش داده می‌شود.", error: "خطا", namePlaceholder: "نام شما *", bodyPlaceholder: "نظر شما (پس از تایید نمایش داده می‌شود)…", submit: "ثبت نظر" };
  const [name, setName] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      const res = await fetch(`/api/blog/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, body }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? t.error);
      setDone(true);
      toast.success(t.toastDone);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.error);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="b-card-sm !rounded-2xl p-4 text-center flex items-center justify-center gap-2">
        <Check className="w-4 h-4 text-spring shrink-0" />
        <b className="text-[14px]">{t.done}</b>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input
        className="b-input max-w-xs"
        placeholder={t.namePlaceholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <textarea
        rows={3}
        className="b-input !rounded-2xl resize-none"
        placeholder={t.bodyPlaceholder}
        value={body}
        onChange={(e) => setBody(enDigits(e.target.value) === e.target.value ? e.target.value : e.target.value)}
        required
        maxLength={1000}
      />
      <button type="submit" disabled={sending} className="b-btn b-btn-spring b-btn-sm self-start">
        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5 flip-rtl" />} {t.submit}
      </button>
    </form>
  );
}
