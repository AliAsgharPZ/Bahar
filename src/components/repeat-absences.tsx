"use client";

import Link from "next/link";
import { UserRoundSearch, Megaphone, FileQuestion } from "lucide-react";
import { useApi } from "@/lib/client";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Row = {
  studentId: string; studentName: string; className: string;
  total: number; pendingExcuses: number; lastDate: string; hasParent: boolean;
};

/** پیگیری غیبت‌های مکرر — پل حضور و غیاب به توجیه و احضار اولیا */
export function RepeatAbsencesPanel() {
  const { t } = useLang();
  const { data } = useApi<{ rows: Row[] }>("/api/attendance/repeat-absences?min=3");
  if (!data) return null;
  return (
    <div className="b-card p-5 flex flex-col gap-3">
      <h3 className="font-bold text-[15px] flex items-center gap-2">
        <UserRoundSearch className="w-4.5 h-4.5" />
        {t("repeatAbs.title")}
      </h3>
      <p className="text-[12px] text-steel leading-5">{t("repeatAbs.desc")}</p>
      {data.rows.length === 0 ? (
        <p className="text-[13px] text-steel">{t("repeatAbs.empty")}</p>
      ) : (
        data.rows.map((r) => (
          <div key={r.studentId} className="b-card-sm p-3.5 flex items-center gap-2 flex-wrap">
            <b className="text-[13px]">{r.studentName}</b>
            {r.className ? <span className="text-[12px] text-steel">{r.className}</span> : null}
            <span className="b-badge b-badge-danger">{faNumber(r.total)} {t("repeatAbs.times")}</span>
            {r.pendingExcuses > 0 && (
              <span className="b-badge b-badge-warning">{faNumber(r.pendingExcuses)} {t("repeatAbs.pendingExcuse")}</span>
            )}
            <span className="text-[12px] text-steel">
              {t("repeatAbs.last")}: {faNumber(r.lastDate)}
            </span>
            <span className="ms-auto flex gap-2">
              <Link className="b-btn b-btn-ghost !h-10" href="/app/excuses">
                <FileQuestion className="w-4 h-4" />
                {t("nav.excuses")}
              </Link>
              {r.hasParent && (
                <Link className="b-btn b-btn-primary !h-10" href={`/app/excuses?summon=${r.studentId}#summons`}>
                  <Megaphone className="w-4 h-4" />
                  {t("summons.fromExcuse")}
                </Link>
              )}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
