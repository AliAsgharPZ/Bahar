"use client";

import { Suspense, useEffect, useState } from "react";
import Script from "next/script";
import { Loader2, Sprout, GraduationCap, Wallet, ClipboardCheck, Users } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { faNumber } from "@/lib/persian";

type Grade = { subject: string; score: number; maxScore: number; kind: string };
type Child = { id: string; name: string; className: string | null; todayStatus: string | null; unpaidFees: number; recentGrades: Grade[] };
type Summary = {
  linked: boolean;
  name?: string;
  roleLabel?: string;
  schoolName?: string | null;
  today?: string;
  className?: string | null;
  todayStatus?: string | null;
  unpaidFees?: number;
  recentGrades?: Grade[];
  children?: Child[];
  schoolToday?: { present: number; absent: number; late: number };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } };
  }
}

const STATUS_FA: Record<string, string> = {
  PRESENT: "حاضر",
  ABSENT: "غایب",
  LATE: "تأخیر",
  EXCUSED: "موجه",
  MISSION: "مأموریت",
  HALF_DAY: "نیم‌روز",
};

function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="text-muted-foreground">امروز ثبت نشده</span>;
  return <span className="font-medium">{STATUS_FA[status] ?? status}</span>;
}

function Grades({ grades }: { grades: Grade[] }) {
  if (!grades.length) return null;
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {grades.map((g, i) => (
        <li key={i} className="flex justify-between gap-2">
          <span>{g.subject}</span>
          <span dir="ltr">{faNumber(g.score)}/{faNumber(g.maxScore)}</span>
        </li>
      ))}
    </ul>
  );
}

function MiniAppInner() {
  const { t } = useLang();
  const [state, setState] = useState<"loading" | "ready" | "outside" | "error">("loading");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    const connectionId = new URLSearchParams(window.location.search).get("c") ?? "";
    let tries = 0;
    const tick = async () => {
      const initData = window.Telegram?.WebApp?.initData;
      if (!initData) {
        tries += 1;
        if (tries < 10) { window.setTimeout(tick, 300); return; }
        setState("outside");
        return;
      }
      window.Telegram?.WebApp?.ready?.();
      window.Telegram?.WebApp?.expand?.();
      try {
        const res = await fetch("/api/bots/miniapp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId, initData }),
        });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { data?: Summary };
        setSummary(json.data ?? null);
        setState("ready");
      } catch {
        setState("error");
      }
    };
    void tick();
  }, []);

  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      <header className="flex items-center gap-2 pt-2">
        <Sprout className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-lg font-bold leading-tight">مینی‌اپ بهار</h1>
          {summary?.schoolName && <p className="text-sm text-muted-foreground">{summary.schoolName}</p>}
        </div>
      </header>

      {state === "loading" && (
        <div className="flex items-center gap-2 text-muted-foreground py-10 justify-center">
          <Loader2 className="w-5 h-5 animate-spin" /> در حال بارگذاری…
        </div>
      )}
      {state === "outside" && (
        <div className="b-card p-4 text-sm leading-7">
          این صفحه مینی‌اپ بهار است و باید از داخل ربات مدرسه در تلگرام یا بله باز شود. ربات را باز کنید و روی دکمهٔ «مینی‌اپ بهار» بزنید.
        </div>
      )}
      {state === "error" && <div className="b-card p-4 text-sm">خطا در برقراری ارتباط؛ دوباره تلاش کنید.</div>}

      {state === "ready" && summary && !summary.linked && (
        <div className="b-card p-4 text-sm leading-7">
          این چت هنوز به حساب بهار وصل نیست. وارد پنل بهار شوید، از بخش «ربات‌ها و مینی‌اپ» کد پیوند بگیرید و در همین ربات بفرستید:
          <div dir="ltr" className="text-start font-mono mt-1">/start CODE</div>
        </div>
      )}

      {state === "ready" && summary?.linked && (
        <>
          <div className="b-card p-4">
            <p className="font-bold">{summary.name}</p>
            <p className="text-sm text-muted-foreground">{summary.roleLabel} · امروز {summary.today}</p>
          </div>

          {summary.schoolToday && (
            <div className="b-card p-4 space-y-2">
              <h2 className="font-bold flex items-center gap-2"><Users className="w-5 h-5" /> حضور امروز مدرسه</h2>
              <div className="grid grid-cols-3 text-center">
                <div><p className="text-xl font-bold">{faNumber(summary.schoolToday.present)}</p><p className="text-xs text-muted-foreground">حاضر</p></div>
                <div><p className="text-xl font-bold">{faNumber(summary.schoolToday.late)}</p><p className="text-xs text-muted-foreground">تأخیر</p></div>
                <div><p className="text-xl font-bold">{faNumber(summary.schoolToday.absent)}</p><p className="text-xs text-muted-foreground">غایب</p></div>
              </div>
            </div>
          )}

          {summary.children?.map((child) => (
            <div key={child.id} className="b-card p-4 space-y-1">
              <p className="font-bold flex items-center gap-2"><GraduationCap className="w-5 h-5" /> {child.name}</p>
              {child.className && <p className="text-sm text-muted-foreground">{child.className}</p>}
              <p className="text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> وضعیت امروز: <StatusChip status={child.todayStatus} /></p>
              {child.unpaidFees > 0 && (
                <p className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> {faNumber(child.unpaidFees)} شهریهٔ پرداخت‌نشده</p>
              )}
              <Grades grades={child.recentGrades} />
            </div>
          ))}

          {summary.recentGrades && (
            <div className="b-card p-4 space-y-1">
              {summary.className && <p className="text-sm text-muted-foreground">{summary.className}</p>}
              <p className="text-sm flex items-center gap-2"><ClipboardCheck className="w-4 h-4" /> وضعیت امروز: <StatusChip status={summary.todayStatus} /></p>
              {typeof summary.unpaidFees === "number" && summary.unpaidFees > 0 && (
                <p className="text-sm flex items-center gap-2"><Wallet className="w-4 h-4" /> {faNumber(summary.unpaidFees)} شهریهٔ پرداخت‌نشده</p>
              )}
              <Grades grades={summary.recentGrades} />
            </div>
          )}
        </>
      )}
      <p className="text-center text-xs text-muted-foreground pb-4">{t("bots.title")}</p>
    </main>
  );
}

export default function MiniAppPage() {
  return (
    <LangProvider>
      <Suspense fallback={null}>
        <MiniAppInner />
      </Suspense>
    </LangProvider>
  );
}
