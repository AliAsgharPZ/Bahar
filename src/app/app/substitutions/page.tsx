"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, UserRoundX, Sparkles, Repeat } from "lucide-react";
import { apiGet } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { useLang } from "@/lib/i18n";

type Candidate = { id: string; name: string; sameSubject: boolean };
type Slot = { slotId: string; period: number; className: string; subjectName: string; candidates: Candidate[] };
type Absence = { teacherId: string; teacherName: string; slots: Slot[] };
type SubData = { date: string; dayOfWeek: number; absences: Absence[] };

const DAY_TKEY = ["", "substitutions.day.saturday", "substitutions.day.sunday", "substitutions.day.monday", "substitutions.day.tuesday", "substitutions.day.wednesday", "substitutions.day.thursday", "substitutions.day.friday"];

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function SubstitutionsPage() {
  const { t } = useLang();
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback((d: string) => {
    setLoading(true);
    apiGet<SubData>(`/api/substitutions?date=${d}`)
      .then((res) => { setData(res); setLoadError(""); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : t("substitutions.khta-dr-bargzary")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [load, date]);

  const totalSlots = data?.absences.reduce((s, a) => s + a.slots.length, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title={t("substitutions.jaygzyny-malm-ghayb")}
        desc={t("substitutions.mrkhsy-hay-t-yydshdh-hr-rvz-zng-hay-tht-t-syr-v-namzdhay-azad-br")}
        action={
          <label className="flex items-center gap-2 text-[12.5px] font-semibold">
            <CalendarClock className="w-4 h-4 text-stone" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="b-input w-auto" dir="ltr" />
          </label>
        }
      />

      {loadError && <ErrorBox message={loadError} />}
      {loading && !data ? <LoadingBlock /> : data && (
        <>
          <p className="text-[13px] text-stone mb-5">
            {DAY_TKEY[data.dayOfWeek] ? t(DAY_TKEY[data.dayOfWeek]) : ""} · {formatDateFa(data.date)} —{" "}
            {data.absences.length === 0
              ? t("substitutions.hych-mrkhsy-t-yydshdh-ay-bray-ayn-rvz-nyst")
              : `${faNumber(data.absences.length)} ${t("substitutions.hmkar-dr-mrkhsy")} ${faNumber(totalSlots)} ${t("substitutions.zng-nyazmnd-jaygzyn")}`}
          </p>

          {data.absences.length === 0 ? (
            <EmptyState icon={Sparkles} title={t("substitutions.hmh-sr-klas-and")} desc={t("substitutions.bray-ayn-rvz-mrkhsy-t-yydshdh-ay-sbt-nshdh-ast")} />
          ) : (
            <div className="flex flex-col gap-4 b-auto-stagger">
              {data.absences.map((a) => (
                <section key={a.teacherId} className="b-card p-4 md:p-5">
                  <header className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-9 h-9 rounded-full bg-[--critical-soft] text-[--critical] flex items-center justify-center" aria-hidden="true">
                      <UserRoundX className="w-4.5 h-4.5" />
                    </span>
                    <h2 className="font-extrabold text-[15px]">{a.teacherName}</h2>
                    <span className="b-badge b-badge-critical">{t("substitutions.dr-mrkhsy")}</span>
                    {a.slots.length === 0 && <span className="text-[12px] text-stone">{t("substitutions.ayn-rvz-zngy-dr-brnamh-ndard")}</span>}
                  </header>
                  {a.slots.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {a.slots.map((s) => (
                        <div key={s.slotId} className="rounded-xl border border-[--hairline] p-3.5">
                          <p className="font-bold text-[13.5px] mb-2.5">
                            {t("substitutions.zng")} {faNumber(s.period)} · {s.className} · {s.subjectName}
                          </p>
                          {s.candidates.length === 0 ? (
                            <p className="text-[12.5px] text-[--critical]">{t("substitutions.dr-ayn-zng-hmh-malm-ha-klas-darnd-jaygzyn-azady-nyst")}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {s.candidates.map((c) => (
                                <span key={c.id} className={`b-badge ${c.sameSubject ? "b-badge-success" : ""}`} title={c.sameSubject ? t("substitutions.malm-hmyn-drs") : t("substitutions.azad-dr-ayn-zng")}>
                                  {c.name}{c.sameSubject ? t("substitutions.hm-drs") : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
