"use client";

import Link from "next/link";
import { Armchair, Printer } from "lucide-react";
import { useApi } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type MyCard = {
  id: string; planId: string; planTitle: string; planDate: string; sessionNo: number;
  roomName: string; seatNo: number; studentId: string; studentName: string; studentNumber: string; className: string;
};

/** کارت ورود به جلسه و شماره صندلی — نمای دانش‌آموز و ولی در صفحه امتحانات */
export function MyExamCards() {
  const { t } = useLang();
  const { data } = useApi<{ cards: MyCard[] }>("/api/exam-seats/mine");
  if (!data) return null;
  if (!data.cards.length) return null;
  return (
    <div className="b-card p-5 flex flex-col gap-3">
      <h3 className="font-bold text-[15px] flex items-center gap-2">
        <Armchair className="w-4.5 h-4.5" />
        {t("examSeats.my.title")}
      </h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {data.cards.map((c) => (
          <div key={c.id} className="b-card-sm p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <b className="text-[13px]">{c.planTitle}</b>
              <span className="text-[12px] text-steel">{faNumber(c.planDate)}</span>
              <span className="ms-auto">
                <Link className="b-btn b-btn-ghost !h-9" href={`/print/exam-cards/${c.planId}?session=${c.sessionNo}&student=${c.studentId}`} target="_blank">
                  <Printer className="w-3.5 h-3.5" />
                  {t("examSeats.printCards")}
                </Link>
              </span>
            </div>
            <p className="text-[12px] text-steel">
              {c.studentName} · {c.className} · {t("examSeats.card.studentNo")}: <span dir="ltr">{c.studentNumber}</span>
            </p>
            <div className="flex items-end gap-3">
              <span className="flex flex-col">
                <span className="text-[10px] text-steel">{t("examSeats.card.seatNo")}</span>
                <b className="text-[30px] leading-8">{faNumber(c.seatNo)}</b>
              </span>
              <span className="text-[12px] pb-1">
                {t("examSeats.card.room")}: <b>{c.roomName}</b> · {t("examSeats.card.session")}: <b>{faNumber(c.sessionNo)}</b>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
