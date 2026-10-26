"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, UserRoundX, Sparkles, Repeat } from "lucide-react";
import { apiGet } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";

type Candidate = { id: string; name: string; sameSubject: boolean };
type Slot = { slotId: string; period: number; className: string; subjectName: string; candidates: Candidate[] };
type Absence = { teacherId: string; teacherName: string; slots: Slot[] };
type SubData = { date: string; dayOfWeek: number; absences: Absence[] };

const DAY_NAMES = ["", "شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function SubstitutionsPage() {
  const [date, setDate] = useState(todayIso());
  const [data, setData] = useState<SubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const load = useCallback((d: string) => {
    setLoading(true);
    apiGet<SubData>(`/api/substitutions?date=${d}`)
      .then((res) => { setData(res); setLoadError(""); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(date); }, [load, date]);

  const totalSlots = data?.absences.reduce((s, a) => s + a.slots.length, 0) ?? 0;

  return (
    <div>
      <PageHeader
        title="جایگزینی معلم غایب"
        desc="مرخصی‌های تأییدشدهٔ هر روز، زنگ‌های تحت تأثیر و نامزدهای آزاد برای جایگزینی"
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
            {DAY_NAMES[data.dayOfWeek] ?? ""} · {formatDateFa(data.date)} —{" "}
            {data.absences.length === 0
              ? "هیچ مرخصی تأییدشده‌ای برای این روز نیست."
              : `${faNumber(data.absences.length)} همکار در مرخصی · ${faNumber(totalSlots)} زنگ نیازمند جایگزین`}
          </p>

          {data.absences.length === 0 ? (
            <EmptyState icon={Sparkles} title="همه سر کلاس‌اند" desc="برای این روز مرخصی تأییدشده‌ای ثبت نشده است." />
          ) : (
            <div className="flex flex-col gap-4 b-auto-stagger">
              {data.absences.map((a) => (
                <section key={a.teacherId} className="b-card p-4 md:p-5">
                  <header className="flex items-center gap-2.5 mb-3.5">
                    <span className="w-9 h-9 rounded-full bg-[--critical-soft] text-[--critical] flex items-center justify-center" aria-hidden="true">
                      <UserRoundX className="w-4.5 h-4.5" />
                    </span>
                    <h2 className="font-extrabold text-[15px]">{a.teacherName}</h2>
                    <span className="b-badge b-badge-critical">در مرخصی</span>
                    {a.slots.length === 0 && <span className="text-[12px] text-stone">این روز زنگی در برنامه ندارد</span>}
                  </header>
                  {a.slots.length > 0 && (
                    <div className="flex flex-col gap-3">
                      {a.slots.map((s) => (
                        <div key={s.slotId} className="rounded-xl border border-[--hairline] p-3.5">
                          <p className="font-bold text-[13.5px] mb-2.5">
                            زنگ {faNumber(s.period)} · {s.className} · {s.subjectName}
                          </p>
                          {s.candidates.length === 0 ? (
                            <p className="text-[12.5px] text-[--critical]">در این زنگ همهٔ معلم‌ها کلاس دارند — جایگزین آزادی نیست.</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {s.candidates.map((c) => (
                                <span key={c.id} className={`b-badge ${c.sameSubject ? "b-badge-success" : ""}`} title={c.sameSubject ? "معلم همین درس" : "آزاد در این زنگ"}>
                                  {c.name}{c.sameSubject ? " · هم‌درس" : ""}
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
