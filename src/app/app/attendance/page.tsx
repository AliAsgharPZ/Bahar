"use client";

import { useLang } from "@/lib/i18n";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Save, Loader2, ClipboardCheck, CheckCircle2, XCircle, Clock, FileText, Trash2, HeartPulse } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { todayJalali, toJalaliKey, faNumber } from "@/lib/persian";

type HealthAlert = { sportsStatus: string; sportsNote: string | null; conditions: string | null; mobilityNote: string | null; allergies: string | null; flags: string[] };
type SheetStudent = { studentId: string; userId: string; fullName: string; nationalId: string; studentNumber: string; status: string | null; note: string | null; healthAlert?: HealthAlert | null };
type Me = { user: { role: string; permissions: string[]; actingSchool?: { id: string; name: string } | null; children: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }>; studentProfile: unknown } };
type ClassRow = { id: string; name: string };



function lastDays(n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(toJalaliKey(new Date(Date.now() - i * 24 * 3600 * 1000)));
  }
  return out;
}

export default function AttendancePage() {
  const { t } = useLang();
  const STATUS_OPTIONS = [
    { value: "PRESENT", label: t("enum.attendance.PRESENT"), cls: "b-badge-success", icon: CheckCircle2 },
    { value: "ABSENT", label: t("enum.attendance.ABSENT"), cls: "b-badge-critical", icon: XCircle },
    { value: "LATE", label: t("enum.attendance.LATE"), cls: "b-badge-warning", icon: Clock },
    { value: "EXCUSED", label: t("enum.attendance.EXCUSED"), cls: "b-badge-neutral", icon: FileText },
  ];
  const { data: me } = useApi<Me>("/api/auth/me");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayJalali());
  const [sheet, setSheet] = useState<Record<string, { status: string; note: string }>>({});
  const [saving, setSaving] = useState(false);

  const role = me?.user.role;
  const isStudent = role === "STUDENT";
  const isParent = role === "PARENT";
  const [childId, setChildId] = useState("");

  // FIX (راند ۱۶): نقش خدماتی فقط داخل پنل مدرسه شیست حضور می‌بیند
  const inPanel = Boolean(me?.user.actingSchool);
  const canTake = role === "MANAGER" || (inPanel && (role === "SUPER_ADMIN" || role === "ADMIN")) || Boolean(me?.user.permissions.includes("take_attendance"));

  const { data: classesData } = useApi<{ classes: ClassRow[] }>(canTake ? "/api/classes" : null);
  const { data: meFull } = useApi<{ user: { children: Array<{ student: { id: string; user: { firstName: string; lastName: string } } }> } }>(isParent ? "/api/auth/me" : null);

  useEffect(() => {
    if (canTake && classesData?.classes?.length && !classId) setClassId(classesData.classes[0].id);
    if (isParent && meFull?.user.children?.length && !childId) setChildId(meFull.user.children[0].student.id);
  }, [canTake, classesData, classId, isParent, meFull, childId]);

  const sheetUrl = canTake && classId ? `/api/attendance?classId=${classId}&date=${date}` : null;
  const { data: sheetData, loading: sheetLoading, error: sheetError, refetch: refetchSheet } = useApi<{ students: SheetStudent[] }>(sheetUrl, [classId, date]);

  const historyUrl = isStudent ? "/api/attendance" : isParent && childId ? `/api/attendance?studentId=${childId}` : null;
  const { data: historyData, loading: historyLoading, error: historyError } = useApi<{ records: Array<{ id: string; date: string; status: string; note: string | null }> }>(historyUrl, [childId]);

  useEffect(() => {
    if (!sheetData) return;
    const s: Record<string, { status: string; note: string }> = {};
    for (const st of sheetData.students) {
      s[st.studentId] = { status: st.status ?? "PRESENT", note: st.note ?? "" };
    }
    setSheet(s);
  }, [sheetData]);

  function setStatus(studentId: string, status: string) {
    setSheet((sh) => ({ ...sh, [studentId]: { status, note: sh[studentId]?.note ?? "" } }));
  }
  function setNote(studentId: string, note: string) {
    setSheet((sh) => ({ ...sh, [studentId]: { status: sh[studentId]?.status ?? "PRESENT", note } }));
  }

  async function save() {
    if (!classId || !date) return;
    const records = Object.entries(sheet).map(([studentId, v]) => ({ studentId, status: v.status, note: v.note || null }));
    setSaving(true);
    try {
      await apiPost("/api/attendance", { classId, date, records });
      toast.success(`${t("nav.attendance")} ${date} ${t("attendance.toast.savedSuffix")}`);
      refetchSheet();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  const dayChips = lastDays(7);

  // ─── نمای ثبت (کارکنان) ───
  if (canTake) {
    const counts = Object.values(sheet).reduce<Record<string, number>>((acc, v) => {
      acc[v.status] = (acc[v.status] ?? 0) + 1;
      return acc;
    }, {});
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("nav.attendance")}
          desc={t("attendance.desc")}
          action={
            <span className="flex gap-1.5">
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={!sheetData?.students.length}
                onClick={async () => { if (!window.confirm(t("attendance.confirmClearDay"))) return; try { const r = await apiDelete<{ deleted: number }>(`/api/attendance?classId=${classId}&date=${date}`); toast.success(`${faNumber(r.deleted)} ${t("attendance.toast.recordsDeleted")}`); setSheet({}); refetchSheet(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                <Trash2 className="w-4 h-4" />{t("attendance.clearDay")}
              </button>
              <button className="b-btn b-btn-spring b-btn-sm" onClick={save} disabled={saving || !sheetData?.students.length}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {t("attendance.saveSheet")}
              </button>
            </span>
          }
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("attendance.filter.class")}
            <Select
              value={classId}
              onChange={(v) => setClassId(v)}
              options={(classesData?.classes ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </label>
          <label className="flex items-center gap-2 text-[12.5px] font-bold">
            {t("attendance.filter.date")}
            <input className="b-input !w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} placeholder="1404-07-10" />
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {dayChips.map((d, i) => (
              <button key={d} onClick={() => setDate(d)} className={`b-pill-tab !text-[12px] !px-3 !py-1 ${date === d ? "b-pill-tab-active" : ""}`}>
                {i === 0 ? t("dashboard.today") : d.slice(5)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={CheckCircle2} label={t("enum.attendance.PRESENT")} value={counts.PRESENT ?? 0} tone="spring" />
          <StatCard icon={XCircle} label={t("enum.attendance.ABSENT")} value={counts.ABSENT ?? 0} tone="blossom" />
          <StatCard icon={Clock} label={t("enum.attendance.LATE")} value={counts.LATE ?? 0} />
          <StatCard icon={FileText} label={t("enum.attendance.EXCUSED")} value={counts.EXCUSED ?? 0} tone="ink" />
        </div>

        {sheetError && <ErrorBox message={sheetError} />}
        {sheetLoading && <LoadingBlock />}
        {sheetData && sheetData.students.length === 0 && (
          <EmptyState icon={ClipboardCheck} title={t("attendance.empty.noStudent")} />
        )}
        {sheetData && sheetData.students.length > 0 && (
          <div className="flex flex-col gap-2.5">
            {sheetData.students.map((st) => (
              <div key={st.studentId} className="b-card-sm !rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 md:w-56">
                  <span className="w-9 h-9 rounded-full bg-spring-tint text-spring flex items-center justify-center text-[12px] font-bold shrink-0">
                    {st.fullName.split(" ").map((x) => x[0]).slice(0, 2).join("")}
                  </span>
                  <span className="flex flex-col min-w-0">
                    <b className="text-[13.5px] truncate">{st.fullName}</b>
                    <span className="text-[10.5px] text-steel" dir="ltr">{st.studentNumber}</span>
                    {st.healthAlert && (
                      <span className="b-badge b-badge-blossom mt-1 self-start" title={[st.healthAlert.sportsNote, st.healthAlert.conditions, st.healthAlert.mobilityNote, st.healthAlert.allergies].filter(Boolean).join(" · ")}>
                        <HeartPulse className="w-3 h-3" />
                        {st.healthAlert.sportsStatus === "EXEMPT" ? t("attendance.health.exempt") : st.healthAlert.sportsStatus === "LIMITED" ? t("attendance.health.limited") : t("attendance.health.alert")}
                        {st.healthAlert.flags.length > 0 ? ` · ${st.healthAlert.flags.join("، ")}` : ""}
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {STATUS_OPTIONS.map((o) => {
                    const active = (sheet[st.studentId]?.status ?? "PRESENT") === o.value;
                    return (
                      <button
                        key={o.value}
                        onClick={() => setStatus(st.studentId, o.value)}
                        className={`b-pill-tab !text-[11.5px] ${active ? "b-pill-tab-active" : ""}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  className="b-input md:flex-1 !h-10 !text-[12.5px]"
                  placeholder={t("attendance.placeholder.note")}
                  value={sheet[st.studentId]?.note ?? ""}
                  onChange={(e) => setNote(st.studentId, e.target.value)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── کارمند بدون دسترسی ثبت حضور ───
  if (!canTake && !isStudent && !isParent) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={t("nav.attendance")}
          desc={t("attendance.desc")}
        />
        <EmptyState
          icon={ClipboardCheck}
          title={t("attendance.noAccess.title")}
          desc={t("attendance.noAccess.desc")}
        />
      </div>
    );
  }

  // ─── نمای دانش‌آموز/ولی ───
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.attendance")}
        desc={isParent ? t("attendance.desc.parent") : t("attendance.desc.student")}
      />

      {isParent && (meFull?.user.children?.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-2">
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

      {historyError && <ErrorBox message={historyError} />}
      {historyLoading && <LoadingBlock />}
      {historyData && historyData.records.length === 0 && (
        <EmptyState icon={ClipboardCheck} title={t("attendance.empty.noHistory")} />
      )}
      {historyData && historyData.records.length > 0 && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={CheckCircle2} label={t("enum.attendance.PRESENT")} value={historyData.records.filter((r) => r.status === "PRESENT").length} tone="spring" />
            <StatCard icon={XCircle} label={t("enum.attendance.ABSENT")} value={historyData.records.filter((r) => r.status === "ABSENT").length} tone="blossom" />
            <StatCard icon={Clock} label={t("enum.attendance.LATE")} value={historyData.records.filter((r) => r.status === "LATE").length} />
            <StatCard icon={FileText} label={t("enum.attendance.EXCUSED")} value={historyData.records.filter((r) => r.status === "EXCUSED").length} tone="ink" />
          </div>
          <div className="b-card-sm overflow-hidden">
            <div className="max-h-[420px] overflow-auto b-scroll">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b border-hairline-soft text-steel text-[11.5px]">
                    <th className="text-right py-3 px-4 font-bold">{t("common.date")}</th>
                    <th className="text-right py-3 px-4 font-bold">{t("common.status")}</th>
                    <th className="text-right py-3 px-4 font-bold">{t("attendance.table.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyData.records.map((r) => {
                    const o = STATUS_OPTIONS.find((s) => s.value === r.status);
                    return (
                      <tr key={r.id} className="b-row border-b border-hairline-soft/60 last:border-0">
                        <td className="py-3 px-4 font-mono text-[12px]" dir="ltr">{faNumber(r.date)}</td>
                        <td className="py-3 px-4"><span className={`b-badge ${o?.cls ?? "b-badge-neutral"}`}>{STATUS_OPTIONS.find((s) => s.value === r.status)?.label ?? r.status}</span></td>
                        <td className="py-3 px-4 text-steel text-[12px]">{r.note ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
