"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Printer, ShieldX, Sprout } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { faNumber } from "@/lib/persian";

type QrData = { svg: string; url: string; date: string };
type Me = { schoolName: string | null };

function PosterInner() {
  const { t } = useLang();
  const [qr, setQr] = useState<QrData | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [qrRes, meRes] = await Promise.all([
          fetch("/api/attendance/school-qr"),
          fetch("/api/auth/me"),
        ]);
        if (!qrRes.ok) throw new Error();
        setQr((await qrRes.json()) as QrData);
        if (meRes.ok) setMe((await meRes.json()) as Me);
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  return (
    <main className="min-h-dvh bg-white text-ink flex flex-col items-center p-4">
      <div className="flex items-center gap-2 print:hidden">
        <button type="button" className="b-btn b-btn-primary !h-11" onClick={() => window.print()} disabled={!qr}>
          <Printer className="w-4 h-4" />
          {t("attendance.p.print")}
        </button>
        <Link href="/app/attendance" className="b-btn b-btn-ghost !h-11">
          {t("attendance.g.goApp")}
        </Link>
      </div>

      {failed ? (
        <div className="flex flex-col items-center gap-2 mt-16 text-center">
          <ShieldX className="w-10 h-10 text-danger" />
          <p className="font-bold">{t("attendance.g.invalid")}</p>
        </div>
      ) : !qr ? (
        <Loader2 className="w-8 h-8 animate-spin text-spring mt-16" />
      ) : (
        <section className="w-full max-w-md flex flex-col items-center gap-4 mt-6 text-center">
          <span className="flex items-center gap-2 text-spring">
            <Sprout className="w-8 h-8" />
            <b className="text-2xl text-ink">{me?.schoolName ?? t("attendance.g.title")}</b>
          </span>
          <h1 className="text-xl font-bold">{t("attendance.m.schoolQr")}</h1>
          <div className="rounded-3xl border-2 border-ink/80 p-3" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <p className="text-[15px] font-bold">
            {t("attendance.p.today")} {faNumber(qr.date)}
          </p>
          <ol className="flex flex-col gap-2 text-start w-full max-w-sm">
            <li className="flex items-start gap-2 text-[14px] leading-6">
              <span className="b-badge b-badge-success shrink-0">{faNumber("1")}</span>
              {t("attendance.p.step1")}
            </li>
            <li className="flex items-start gap-2 text-[14px] leading-6">
              <span className="b-badge b-badge-success shrink-0">{faNumber("2")}</span>
              {t("attendance.p.step2")}
            </li>
            <li className="flex items-start gap-2 text-[14px] leading-6">
              <span className="b-badge b-badge-success shrink-0">{faNumber("3")}</span>
              {t("attendance.p.step3")}
            </li>
          </ol>
        </section>
      )}
    </main>
  );
}

export default function SchoolQrPosterPage() {
  return (
    <LangProvider>
      <PosterInner />
    </LangProvider>
  );
}
