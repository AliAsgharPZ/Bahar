"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useApi, apiPatch } from "@/lib/client";
import { PageHeader } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null } };
type ClassRow = { id: string; name: string; academicYear: string };
type WeekRow = {
  label: string; start: string; end: string; count: number; overload: boolean;
  bySubject: { name: string; count: number }[];
  pileups: { date: string; count: number }[];
  items: { id: string; title: string; subject: string; dueDate: string }[];
};

export default function HomeworkBalancePage() {
  const { t } = useLang();
  const [classId, setClassId] = useState("");
  const [weeks, setWeeks] = useState("4");
  const [result, setResult] = useState<{ class: { name: string }; weeks: WeekRow[]; summary: { total: number; overloadWeeks: number; lightestWeek: { label: string; count: number; start: string; end: string } | null; suggestion: string } } | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveDates, setMoveDates] = useState<Record<string, string>>({});
  const [movingId, setMovingId] = useState<string | null>(null);

  const { data: me } = useApi<Me>("/api/auth/me");
  // جابه‌جایی فقط برای کسی که PATCH تکلیف را دارد (همان گیت سمت سرور)
  const canMove = me?.user.role === "MANAGER" || (Boolean(me?.user.actingSchool) && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_assignments"));

  async function move(itemId: string) {
    const lightest = result?.summary.lightestWeek;
    if (!lightest) return;
    const chosen = moveDates[itemId] ?? lightest.start;
    if (chosen < lightest.start || chosen > lightest.end) { toast.error(t("homeworkBalance.moveRangeError")); return; }
    setMovingId(itemId);
    try {
      await apiPatch(`/api/assignments/${itemId}`, { dueDate: chosen });
      toast.success(t("homeworkBalance.moveDone"));
      await run();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setMovingId(null); }
  }

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/homework-balance?classId=${classId}&weeks=${weeks}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? t("common.errorShort"));
      setResult(json);
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("homeworkBalance.title")} desc={t("homeworkBalance.desc")} />
      <div className="b-card p-4 md:p-5 flex flex-col sm:flex-row gap-3 sm:items-end">
        <label className="flex flex-col gap-1.5 flex-1 min-w-0">
          <span className="t-sm font-bold">{t("common.class")}</span>
          <Select value={classId} onChange={setClassId} options={[{ value: "", label: t("homeworkBalance.firstClass") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))]} placeholder={t("common.class")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="t-sm font-bold">{t("homeworkBalance.range")}</span>
          <Select value={weeks} onChange={setWeeks} options={[{ value: "2", label: t("homeworkBalance.weeks2") }, { value: "4", label: t("homeworkBalance.weeks4") }, { value: "8", label: t("homeworkBalance.weeks8") }]} placeholder={t("homeworkBalance.range")} />
        </label>
        <button className="b-btn b-btn-ink" onClick={run} disabled={busy}>{busy ? t("homeworkBalance.checking") : t("homeworkBalance.show")}</button>
      </div>

      {!result && <p className="t-sm text-steel">{t("homeworkBalance.hint")}</p>}
      {result && (
        <>
          <div className="b-card p-4 md:p-5">
            <div className="font-bold">{t("common.class")} {result.class.name} — {t("homeworkBalance.totalPrefix")} {result.summary.total} {t("homeworkBalance.totalSuffix")}</div>
            <p className="t-sm text-steel mt-1">{result.summary.suggestion}</p>
            {result.summary.overloadWeeks > 0 && (
              <p className="t-sm font-bold text-blossom mt-1">{result.summary.overloadWeeks} {t("homeworkBalance.overloadSuffix")}</p>
            )}
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {result.weeks.map((w) => (
              <div key={w.label} className="b-card p-4 md:p-5 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[14px]">{w.label}</b>
                  <span className={`b-badge ${w.overload ? "b-badge-blossom" : "b-badge-spring"}`}>
                    {w.count} {t("homeworkBalance.assignmentUnit")}{w.overload ? ` · ${t("homeworkBalance.overloadTag")}` : ""}
                  </span>
                </div>
                {w.bySubject.length > 0 && (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm min-w-[240px]">
                      <tbody>
                        {w.bySubject.map((s) => (
                          <tr key={s.name} className="border-t border-hairline-soft">
                            <td className="py-1.5 pe-2">{s.name}</td>
                            <td className="py-1.5 text-end font-bold">{s.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {w.pileups.length > 0 && (
                  <p className="t-sm text-blossom mt-2">
                    {t("homeworkBalance.pileupPrefix")} {w.pileups.map((p) => `${p.date} (${p.count} ${t("homeworkBalance.assignmentUnit")})`).join("، ")}
                  </p>
                )}
                {w.items.length === 0 && <p className="t-sm text-steel mt-2">{t("homeworkBalance.noAssignments")}</p>}
                {result.summary.overloadWeeks > 0 && canMove && result.summary.lightestWeek && w.label !== result.summary.lightestWeek.label && w.items.length > 0 && (
                  <div className="mt-3 border-t border-hairline-soft pt-3">
                    <p className="t-sm font-bold">{t("homeworkBalance.moveHint")} {result.summary.lightestWeek.label}</p>
                    <div className="flex flex-col gap-2 mt-2">
                      {w.items.map((it) => (
                        <div key={it.id} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                          <span className="t-sm min-w-0 flex-1 truncate">{it.title} · {it.subject} · {it.dueDate.slice(0, 10)}</span>
                          <label className="flex items-center gap-2">
                            <span className="t-sm text-steel">{t("homeworkBalance.moveNewDate")}</span>
                            <input
                              type="date"
                              className="b-input !w-auto"
                              min={result.summary.lightestWeek?.start}
                              max={result.summary.lightestWeek?.end}
                              value={moveDates[it.id] ?? result.summary.lightestWeek?.start ?? ""}
                              onChange={(e) => setMoveDates((m) => ({ ...m, [it.id]: e.target.value }))}
                            />
                          </label>
                          <button className="b-btn b-btn-sm b-btn-ink" onClick={() => move(it.id)} disabled={movingId === it.id}>
                            {movingId === it.id ? t("homeworkBalance.moveBusy") : t("homeworkBalance.moveAction")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
