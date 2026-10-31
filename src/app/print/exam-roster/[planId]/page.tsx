"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Loader2, Printer, ShieldX, Sprout } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { faNumber } from "@/lib/persian";

type Assignment = { id: string; sessionNo: number; roomName: string; seatNo: number; studentName: string; studentNumber: string; className: string };
type Detail = {
  plan: { id: string; title: string; date: string; sessions: number };
  schoolName: string;
  assignments: Assignment[];
};

/** لیست جلسه برای مراقب: به تفکیک اتاق، مرتب بر اساس شماره صندلی، با ستون امضا */
function RosterInner() {
  const { t } = useLang();
  const params = useParams<{ planId: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);
  const [session, setSession] = useState(1);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = Number(q.get("session") ?? "1");
    if (s >= 1) setSession(s);
    (async () => {
      try {
        const res = await fetch(`/api/exam-seats?id=${params.planId}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { data?: Detail } & Detail;
        setData((json as { data?: Detail }).data ?? (json as Detail));
      } catch {
        setFailed(true);
      }
    })();
  }, [params.planId]);

  const rows = (data?.assignments ?? []).filter((a) => a.sessionNo === session);
  const roomNames = [...new Set(rows.map((r) => r.roomName))];

  return (
    <main className="min-h-dvh bg-white text-ink">
      <style>{`
        @page { size: A4 portrait; margin: 12mm; }
        .roster-room { break-inside: avoid; margin-bottom: 10mm; }
        .roster-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        .roster-table th, .roster-table td { border: 0.3mm solid #9aa3ad; padding: 1.6mm 2mm; text-align: start; }
        @media print { .roster-toolbar { display: none !important; } }
      `}</style>

      <div className="roster-toolbar flex items-center gap-2 p-4 flex-wrap">
        <button type="button" className="b-btn b-btn-primary !h-11" onClick={() => window.print()} disabled={!data}>
          <Printer className="w-4 h-4" />
          {t("examSeats.printRoster")}
        </button>
        {data && data.plan.sessions > 1 && (
          <span className="flex gap-1.5" role="tablist" aria-label={t("examSeats.session")}>
            {Array.from({ length: data.plan.sessions }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={session === n}
                onClick={() => setSession(n)}
                className={`b-pill-tab !px-3.5 !py-2 ${session === n ? "b-pill-tab-active" : ""}`}
              >
                {t("examSeats.session")} {faNumber(n)}
              </button>
            ))}
          </span>
        )}
        <Link href="/app/exam-seats" className="b-btn b-btn-ghost !h-11">
          {t("attendance.g.goApp")}
        </Link>
      </div>

      {failed ? (
        <div className="flex flex-col items-center gap-2 mt-16 text-center">
          <ShieldX className="w-10 h-10 text-danger" />
          <p className="font-bold">{t("attendance.g.invalid")}</p>
        </div>
      ) : !data ? (
        <Loader2 className="w-8 h-8 animate-spin text-spring mx-auto mt-16" />
      ) : (
        <div className="p-4 print:p-0 max-w-4xl mx-auto flex flex-col">
          {roomNames.map((room) => {
            const roomRows = rows.filter((r) => r.roomName === room).sort((a, b) => a.seatNo - b.seatNo);
            return (
              <section key={room} className="roster-room">
                <header className="flex items-center gap-2 mb-2 flex-wrap">
                  <Sprout className="w-5 h-5 text-spring shrink-0" />
                  <b className="text-[14px]">{data.schoolName}</b>
                  <span className="text-[12px] text-steel">
                    {data.plan.title} · {t("examSeats.session")} {faNumber(session)} · {faNumber(data.plan.date)}
                  </span>
                  <b className="ms-auto text-[14px]">{room}</b>
                </header>
                <table className="roster-table">
                  <thead>
                    <tr>
                      <th>{t("examSeats.card.seatNo")}</th>
                      <th>{t("summons.student")}</th>
                      <th>{t("examSeats.card.class")}</th>
                      <th>{t("examSeats.card.studentNo")}</th>
                      <th>{t("examSeats.card.signature")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomRows.map((a) => (
                      <tr key={a.id}>
                        <td><b>{faNumber(a.seatNo)}</b></td>
                        <td>{a.studentName}</td>
                        <td>{a.className}</td>
                        <td dir="ltr">{a.studentNumber}</td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-[12px] mt-3">
                  {t("examSeats.card.inv")}: ………………………………
                </p>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default function ExamRosterPrintPage() {
  return (
    <LangProvider>
      <RosterInner />
    </LangProvider>
  );
}
