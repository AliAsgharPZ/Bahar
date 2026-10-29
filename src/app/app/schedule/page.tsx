"use client";

import { useLang } from "@/lib/i18n";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save, CalendarDays, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { useApi, apiPut, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select, useConfirm } from "@/components/shared/pickers";
import { weekdayLabel, faNumber } from "@/lib/persian";

type Slot = { id: string; dayOfWeek: number; period: number; subjectId: string | null; teacherId: string | null; subject: { id: string; name: string } | null; teacher: { id: string; firstName: string; lastName: string } | null; class: { id: string; name: string } | null };
type ClassRow = { id: string; name: string; grade: string };
type Me = {
  user: {
    role: string;
    permissions: string[];
    actingSchool?: { id: string; name: string } | null;
    studentProfile: { class: { id: string; name: string } | null } | null;
    children?: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }>;
  };
};

// FIX (راند ۱۶): روزهای هفته از پروفایل کشور فعال — ایران: شنبه تا چهارشنبه (۱-۵)
// اگر داده روی پنجشنبه/جمعه باشد ستون آن هم رندر می‌شود (API تا ۷ می‌پذیرد)
function daysOf(slots: Array<{ dayOfWeek: number }> | undefined): number[] {
  const base = [1, 2, 3, 4, 5];
  const extra = [...new Set((slots ?? []).map((s) => s.dayOfWeek))].filter((d) => d >= 6 && d <= 7);
  return [...base, ...extra.sort()];
}
// دوره‌های ۱ تا ۸ پشتیبانی می‌شوند؛ فقط دوره‌های پر نمایش داده می‌شوند (حداقل ۴ دوره)
function periodsOf(slots: Array<{ period: number }> | undefined): number[] {
  const maxUsed = slots?.length ? Math.max(4, ...slots.map((s) => s.period)) : 4;
  return Array.from({ length: Math.min(8, maxUsed) }, (_, i) => i + 1);
}

export default function SchedulePage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const confirm = useConfirm();
  const [classId, setClassId] = useState<string>("");
  const [slotsMap, setSlotsMap] = useState<Record<string, { subjectId: string; teacherId: string }>>({});
  const [saving, setSaving] = useState(false);

  const isStudent = me?.user.role === "STUDENT";
  const isParent = me?.user.role === "PARENT";
  const isTeacher = me?.user.role === "TEACHER";
  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه رابط ویرایش می‌بیند (دکتهای مرده → 403)
  const inPanel = Boolean(me?.user.actingSchool);
  const canEdit = me?.user.role === "MANAGER" || (inPanel && (me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN")) || Boolean(me?.user.permissions.includes("manage_schedule"));

  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isStudent && !isTeacher && !isParent ? "/api/classes" : null);

  // FIX (راند ۱۶): نمای والد — انتخاب فرزند (API از قبل ?childId= را پشتیبانی می‌کند)
  const [childId, setChildId] = useState("");
  const { data: meFull } = useApi<{ user: { children: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }> } }>(isParent ? "/api/auth/me" : null);
  useEffect(() => {
    if (isParent && meFull?.user.children?.length && !childId) setChildId(meFull.user.children[0].student.id);
  }, [isParent, meFull, childId]);

  // انتخاب کلاس پیش‌فرض
  useEffect(() => {
    if (isStudent && me?.user.studentProfile?.class) {
      setClassId(me.user.studentProfile.class.id);
    } else if (!isStudent && !isTeacher && !isParent && classesData?.classes?.length && !classId) {
      setClassId(classesData.classes[0].id);
    }
  }, [me, classesData, isStudent, classId]);

  const url = isTeacher
    ? "/api/schedule"
    : isParent
      ? childId ? `/api/schedule?childId=${childId}` : null
      : classId ? `/api/schedule?classId=${classId}` : null;
  const { data, loading, error, refetch } = useApi<{ slots: Slot[]; scope?: string }>(url, [classId, childId]);

  useEffect(() => {
    if (!data) return;
    const map: Record<string, { subjectId: string; teacherId: string }> = {};
    for (const s of data.slots) {
      map[`${s.dayOfWeek}-${s.period}`] = { subjectId: s.subjectId ?? "", teacherId: s.teacherId ?? "" };
    }
    setSlotsMap(map);
  }, [data]);

  const { data: subjectsData } = useApi<{ subjects: Array<{ id: string; name: string }> }>(canEdit ? "/api/subjects" : null);
  const { data: teachersData } = useApi<{ users: Array<{ id: string; firstName: string; lastName: string }> }>(canEdit ? "/api/users?role=TEACHER" : null);

  const className = useMemo(() => {
    if (isStudent) return me?.user.studentProfile?.class?.name ?? "";
    if (isParent) {
      const child = meFull?.user.children?.find((c) => c.student.id === childId);
      return child ? `${t("common.class")} ${child.student.user.firstName} ${child.student.user.lastName}` : "";
    }
    return classesData?.classes.find((c) => c.id === classId)?.name ?? "";
  }, [me, classesData, classId, isParent, meFull, childId]);

  function setSlot(day: number, period: number, field: "subjectId" | "teacherId", value: string) {
    setSlotsMap((m) => ({
      ...m,
      [`${day}-${period}`]: { subjectId: m[`${day}-${period}`]?.subjectId ?? "", teacherId: m[`${day}-${period}`]?.teacherId ?? "", [field]: value },
    }));
  }

  async function save() {
    if (!classId) return;
    const slots = Object.entries(slotsMap)
      .filter(([, v]) => v.subjectId)
      .map(([key, v]) => {
        const [day, period] = key.split("-").map(Number);
        return { dayOfWeek: day, period, subjectId: v.subjectId, teacherId: v.teacherId || null };
      });
    setSaving(true);
    try {
      await apiPut("/api/schedule", { classId, slots });
      toast.success(t("schedule.toast.saved"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  // ---------- تولید خودکار برنامه (موتور برنامه‌ریزی) ----------
  const canAuto = me?.user.role === "MANAGER" || me?.user.role === "DEPUTY" || me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN";
  type Scenario = { id: number; label: string; slots: Array<{ classId: string; dayOfWeek: number; period: number }>; unscheduled: Array<{ label: string; reason: string }>; scores: { teacher: number; spread: number; special: number; total: number } };
  const [genOpen, setGenOpen] = useState(false);
  const [genLoading, setGenLoading] = useState(false);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [applying, setApplying] = useState<number | null>(null);

  async function openGenerate() {
    setGenOpen(true);
    setGenLoading(true);
    setScenarios([]);
    try {
      const res = await apiPost<{ scenarios: Scenario[] }>("/api/timetable-generate", {});
      setScenarios(res.scenarios ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("schedule.toast.generateError"));
      setGenOpen(false);
    } finally {
      setGenLoading(false);
    }
  }

  async function applyScenario(id: number) {
    if (!(await confirm({ title: t("schedule.apply.title"), description: t("schedule.apply.desc"), confirmLabel: t("schedule.apply.confirm"), danger: true }))) return;
    setApplying(id);
    try {
      await apiPost("/api/timetable-generate", { apply: true, scenario: id });
      toast.success(t("schedule.toast.applied"));
      setGenOpen(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setApplying(null);
    }
  }

  if (loading && !data) return <LoadingBlock label={t("schedule.loading")} />;

  return (
    <div className="flex flex-col gap-6">
      {isParent && (meFull?.user.children?.length ?? 0) > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          {meFull!.user.children.map((c) => (
            <button
              key={c.student.id}
              onClick={() => setChildId(c.student.id)}
              className={`b-pill-tab ${childId === c.student.id ? "b-pill-tab-active" : ""}`}
            >
              {c.student.user.firstName} {c.student.user.lastName}
            </button>
          ))}
        </div>
      )}
      <PageHeader
        title={isTeacher ? t("schedule.title.mine") : t("nav.schedule")}
        desc={isTeacher ? t("schedule.desc.mine") : isStudent ? `${t("schedule.desc.classPrefix")} ${className}` : isParent ? `${t("nav.schedule")} ${className}` : canEdit ? t("schedule.desc.edit") : t("schedule.desc.view")}
        action={
          canEdit && classId && (
            <span className="flex items-center gap-2">
              {canAuto && (
                <button className="b-btn b-btn-soft b-btn-sm" onClick={openGenerate}>
                  <Wand2 className="w-4 h-4" /> {t("schedule.autoGenerate")}
                </button>
              )}
              <button className="b-btn b-btn-spring b-btn-sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("schedule.save")}
              </button>
            </span>
          )
        }
      />

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("schedule.filter.class")}
            <Select
              value={classId}
              onChange={(v) => setClassId(v)}
              options={(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </label>
          {className && <span className="b-badge b-badge-spring">{className}</span>}
        </div>
      )}

      {error && <ErrorBox message={error} />}
      {!url && !canEdit && !isTeacher && (
        <EmptyState
          icon={CalendarDays}
          title={isStudent ? t("schedule.empty.noClassStudent") : isParent ? t("schedule.empty.noScheduleParent") : t("schedule.empty.noClass")}
          desc={isStudent ? t("schedule.empty.noClassStudentDesc") : isParent ? t("schedule.empty.noScheduleParentDesc") : t("schedule.empty.noClassDesc")}
        />
      )}
      {data && data.slots.length === 0 && !canEdit && !isTeacher && (
        <EmptyState icon={CalendarDays} title={t("schedule.empty.noSchedule")} desc={t("schedule.empty.noScheduleDesc")} />
      )}
      {isTeacher && data && data.slots.length === 0 && (
        <EmptyState icon={CalendarDays} title={t("schedule.empty.noPeriodTeacher")} desc={t("schedule.empty.noPeriodTeacherDesc")} />
      )}

      {(data || isTeacher) && (data?.slots?.length || 0) > 0 && (
        <div className="b-card-sm overflow-hidden">
          <div className="overflow-x-auto b-scroll">
            <table className="w-full text-[12.5px] min-w-[640px]">
              <thead>
                <tr className="border-b border-hairline-soft text-steel text-[12px]">
                  <th className="text-right py-3 px-3 font-bold w-16">{t("schedule.table.period")}</th>
                  {daysOf(data?.slots).map((d) => (
                    <th key={d} className="text-right py-3 px-3 font-bold">{weekdayLabel(d)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {periodsOf(data?.slots).map((p) => (
                  <tr key={p} className="border-b border-hairline-soft/60 last:border-0">
                    <td className="py-2.5 px-3">
                      <span className="w-8 h-8 rounded-full bg-spring-tint text-spring flex items-center justify-center font-bold text-[12px]">
                        {faNumber(p)}
                      </span>
                    </td>
                    {daysOf(data?.slots).map((d) => {
                      const key = `${d}-${p}`;
                      const slot = slotsMap[key];
                      const teacherSlot = isTeacher ? data?.slots.find((s) => s.dayOfWeek === d && s.period === p) : null;
                      if (isTeacher) {
                        return (
                          <td key={key} className="py-2.5 px-3">
                            {teacherSlot ? (
                              <div className="b-card-sm !rounded-lg p-2.5 bg-spring-tint !border-transparent">
                                <b className="text-[12px] block truncate">{teacherSlot.subject?.name ?? "—"}</b>
                                <span className="text-[10.5px] text-steel truncate block">{teacherSlot.class?.name ?? ""}</span>
                              </div>
                            ) : (
                              <span className="text-stone">—</span>
                            )}
                          </td>
                        );
                      }
                      if (canEdit) {
                        return (
                          <td key={key} className="py-2 px-2">
                            <div className="flex flex-col gap-1.5">
                              <Select
                                className="w-full"
                                buttonClassName="!w-full !h-9 !text-[12px] !py-0"
                                value={slot?.subjectId ?? ""}
                                onChange={(v) => setSlot(d, p, "subjectId", v)}
                                options={[{ value: "", label: t("schedule.slot.empty") }, ...(subjectsData?.subjects ?? []).map((s) => ({ value: s.id, label: s.name }))]}
                                placeholder={t("schedule.slot.empty")}
                              />
                              <Select
                                className="w-full"
                                buttonClassName="!w-full !h-9 !text-[12px] !py-0"
                                value={slot?.teacherId ?? ""}
                                onChange={(v) => setSlot(d, p, "teacherId", v)}
                                options={[{ value: "", label: t("schedule.slot.teacherPlaceholder") }, ...(teachersData?.users ?? []).map((t) => ({ value: t.id, label: `${t.firstName} ${t.lastName}` }))]}
                                placeholder={t("schedule.slot.teacherPlaceholder")}
                              />
                            </div>
                          </td>
                        );
                      }
                      const view = data?.slots.find((s) => s.dayOfWeek === d && s.period === p);
                      return (
                        <td key={key} className="py-2.5 px-3">
                          {view ? (
                            <div className="flex flex-col">
                              <b className="text-[12.5px]">{view.subject?.name ?? "—"}</b>
                              {view.teacher && <span className="text-[10.5px] text-steel">{view.teacher.firstName} {view.teacher.lastName}</span>}
                            </div>
                          ) : (
                            <span className="text-stone">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canEdit && (
        <div className="b-card-tint !rounded-2xl p-4">
          <p className="t-sm leading-relaxed">
            {t("schedule.hint")}
          </p>
        </div>
      )}
          {/* دیالوگ تولید خودکار برنامه */}
      {genOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !genLoading && setGenOpen(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto b-scroll b-pop">
            <div className="flex items-center justify-between mb-1">
              <h2 className="font-bold text-lg flex items-center gap-2"><Sparkles className="w-5 h-5 text-spring" /> {t("schedule.generate.title")}</h2>
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint" onClick={() => setGenOpen(false)} aria-label={t("common.close")}><X className="w-4 h-4" /></button>
            </div>
            <p className="t-sm text-steel mb-5">
              {t("schedule.generate.desc")}
            </p>

            {genLoading && <LoadingBlock label={t("schedule.generate.loading")} />}
            {!genLoading && scenarios.map((sc) => (
              <div key={sc.id} className="b-card-sm !rounded-2xl p-4 mb-3 flex items-center gap-4">
                <div className="flex-1">
                  <b className="text-[14px]">{t("schedule.generate.option")} {sc.label}</b>
                  <p className="text-[11.5px] text-steel mt-0.5">
                    {faNumber(sc.slots.length)} {t("schedule.generate.periodUnit")} · {t("schedule.generate.quality")} {faNumber(sc.scores.total)}٪ · {t("schedule.generate.teacherLoad")} {faNumber(sc.scores.teacher)} · {t("schedule.generate.spread")} {faNumber(sc.scores.spread)}
                    {sc.unscheduled.length > 0 && <span className="text-blossom"> · {faNumber(sc.unscheduled.length)} {t("schedule.generate.unscheduled")}</span>}
                  </p>
                </div>
                <button className="b-btn b-btn-spring b-btn-sm shrink-0" onClick={() => applyScenario(sc.id)} disabled={applying !== null}>
                  {applying === sc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {t("schedule.apply.confirm")}
                </button>
              </div>
            ))}
            {!genLoading && scenarios.every((sc) => sc.unscheduled.length > 0) && scenarios.length > 0 && (
              <p className="text-[11.5px] text-warning-deep">
                {t("schedule.generate.unscheduledWarning")}
              </p>
            )}
          </div>
        </div>
      )}
</div>
  );
}
