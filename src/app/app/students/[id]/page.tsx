"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Tag, FileCheck, Target, HeartHandshake, Briefcase, Award,
  AlertTriangle, TrendingUp, TrendingDown, Plus, X, CheckCircle2, Clock,
  GraduationCap, Home as HomeIcon, Phone, Cake, Users2, Activity,
} from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPatch } from "@/lib/client";
import { useLang } from "@/lib/i18n";
import { faNumber, formatDateFa, relativeTimeFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, ErrorBox } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import { BarChart } from "@/components/shared/charts";
import { StaggerGroup, StaggerItem } from "@/components/shared/motion";
import { Select } from "@/components/shared/pickers";

type Data360 = {
  student: {
    id: string; studentNumber: string; status: string; healthNotes: string | null; previousSchool: string | null;
    user: { id: string; firstName: string; lastName: string; nationalId: string; fatherName: string | null; gender: string | null; birthDate: string | null; phone: string | null; address: string | null; photoUrl: string | null; birthPlace: string | null; profileImageType: "upload" | "avatar" | null; avatar: import("@/lib/avatar").AvatarParams | null };
    class: { id: string; name: string; grade: string; field: string | null } | null;
    house: { id: string; name: string; color: string } | null;
    parents: Array<{ relation: string; parentUser: { id: string; firstName: string; lastName: string; phone: string | null; jobTitle: string | null; nationalId: string; profileImageType: "upload" | "avatar" | null; photoUrl: string | null; avatar: import("@/lib/avatar").AvatarParams | null } }>;
    attendances: Array<{ date: string; status: string; period: number }>;
    fees: Array<{ id: string; title: string; amount: number; status: string; dueDate: string | null }>;
    documents: Array<{ id: string; kind: string; status: string; receivedAt: string | null; expiresAt: string | null }>;
    goals: Array<{ id: string; title: string; metric: string; targetValue: string | null; currentValue: string | null; status: string; dueDate: string | null }>;
    interventions: Array<{ id: string; kind: string; description: string; outcome: string | null; status: string; startedBy: { firstName: string; lastName: string }; createdAt: string }>;
    portfolioItems: Array<{ id: string; kind: string; title: string; description: string | null; url: string | null; date: string | null }>;
    badges: Array<{ id: string; isFeatured: boolean; badge: { title: string; icon: string; tier: string } }>;
    gradeHistory: Array<{ id: string; oldScore: number | null; newScore: number; source: string; changedBy: { firstName: string; lastName: string } | null; createdAt: string }>;
  };
  analytics: {
    gpa: number | null; trend: number; absences: number; lates: number; attendanceRate: number | null; behaviorPoints: number;
    risk: { score: number; level: string; reasons: string[] };
    patterns: string[]; subjectPattern: string | null;
  };
  subjectBreakdown: Array<{ name: string; avg: number; trend: number }>;
  timeline: Array<{ at: string; kind: string; title: string; detail?: string; tone: string }>;
  canEdit: boolean;
  tags: string[];
  customFields: Record<string, string>;
};

const DOC_KINDS: Array<[string, string]> = [
  ["BIRTH_CERT", "students.detail.doc.birthCert"], ["NATIONAL_ID", "students.detail.doc.nationalId"], ["PHOTO", "students.detail.doc.photo"],
  ["HEALTH_INSURANCE", "students.detail.doc.healthInsurance"], ["PREV_TRANSCRIPT", "students.detail.doc.prevTranscript"],
  ["RESIDENCE", "students.detail.doc.residence"], ["GUARDIAN_ID", "students.detail.doc.guardianId"],
];

const STATUS_TKEY: Record<string, string> = {
  ACTIVE: "common.active", GRADUATED: "enum.studentStatus.GRADUATED",
  TRANSFERRED: "enum.studentStatus.TRANSFERRED", SUSPENDED: "enum.studentStatus.SUSPENDED",
};

const RISK_TKEY: Record<string, string> = {
  SAFE: "students.detail.risk.safe", WATCH: "students.detail.risk.watch",
  RISK: "students.detail.risk.risk", CRITICAL: "students.detail.risk.critical",
};

const TONE_ICON: Record<string, typeof CheckCircle2> = {
  POSITIVE: CheckCircle2, NEGATIVE: AlertTriangle, NEUTRAL: Clock,
};

export default function Student360Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Data360 | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"overview" | "timeline" | "docs" | "goals" | "portfolio">("overview");
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTag, setNewTag] = useState("");
  const { t } = useLang();

  const load = useCallback(() => {
    apiGet<Data360>(`/api/students/${id}/360`).then(setData).catch((e) => setError(e.message));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <LoadingBlock label={t("students.detail.loading360")} />;

  const { student, analytics } = data;
  const riskColor = analytics.risk.level === "CRITICAL" ? "var(--blossom)" : analytics.risk.level === "RISK" ? "var(--warning)" : analytics.risk.level === "WATCH" ? "var(--info)" : "var(--success)";
  const riskTKey = RISK_TKEY[analytics.risk.level];

  /** اعمال تغییر ۳۶۰ با بازخورد خطا (به‌جای حذف بی‌صدا) */
  async function apply360(body: Record<string, unknown>, okMsg?: string) {
    try {
      await apiPatch(`/api/students/${id}/360`, body);
      if (okMsg) toast.success(okMsg);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("students.detail.toast.saveError"));
    }
  }
  async function addTag() {
    const tag = newTag.trim();
    if (!tag) return;
    const next = [...data!.tags, tag];
    await apply360({ op: "tags", tags: next });
    setNewTag("");
    setShowTagInput(false);
  }
  async function removeTag(tag: string) {
    const next = data!.tags.filter((x) => x !== tag);
    await apply360({ op: "tags", tags: next });
  }
  async function setDoc(kind: string, status: string) {
    await apply360({ op: "document", kind, status });
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link href="/app/students" className="w-9 h-9 rounded-full flex items-center justify-center bg-cloud hover:bg-spring-tint transition-colors" aria-label={t("common.back")}>
          <ArrowRight className="w-5 h-5 flip-rtl" />
        </Link>
        <span className="text-[12px] text-steel">{t("nav.students")}</span>
      </div>

      <PageHeader
        title={`${student.user.firstName} ${student.user.lastName}`}
        desc={`${t("students.field.studentNumber")} ${faNumber(student.studentNumber)} — ${student.class?.name ?? t("students.noClass")}${student.house ? ` · ${t("shell.home")} ${student.house.name}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            {student.badges.slice(0, 2).map((b) => (
              <span key={b.id} className="b-badge b-badge-spring"><Award className="w-3 h-3" />{b.badge.title}</span>
            ))}
          </div>
        }
      />

      {/* کارت هویت */}
      <div className="b-card-md p-5 mb-6 flex flex-wrap items-center gap-5">
        <UserAvatar user={student.user} size={80} rounded="xl" />
        <div className="flex-1 min-w-[220px] grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
          <InfoRow icon={Users2} label={t("students.field.fatherName")} value={student.user.fatherName ?? "—"} />
          <InfoRow icon={Tag} label={t("students.field.nationalId")} value={faNumber(student.user.nationalId)} />
          <InfoRow icon={Cake} label={t("profile.field.birthDate")} value={student.user.birthDate ? formatDateFa(student.user.birthDate) : "—"} />
          <InfoRow icon={Phone} label={t("students.detail.contact")} value={student.user.phone ? faNumber(student.user.phone) : "—"} />
          <InfoRow icon={HomeIcon} label={t("students.field.birthPlace")} value={student.user.birthPlace ?? "—"} />
          <InfoRow icon={GraduationCap} label={t("students.field.previousSchool")} value={student.previousSchool ?? "—"} />
          <InfoRow icon={Activity} label={t("students.field.healthNotes")} value={student.healthNotes ?? "—"} />
          <InfoRow icon={Tag} label={t("students.detail.status")} value={STATUS_TKEY[student.status] ? t(STATUS_TKEY[student.status]) : student.status} />
        </div>
        {/* تگ‌ها */}
        <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
          {data.tags.map((tg) => (
            <span key={tg} className="b-badge b-badge-blossom group">
              {tg}
              {data.canEdit && <button onClick={() => removeTag(tg)} className="b-btn b-btn-ghost opacity-50 hover:opacity-100"><X className="w-3 h-3" /></button>}
            </span>
          ))}
          {data.canEdit && (
            showTagInput ? (
              <span className="flex items-center gap-1">
                <input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addTag()}
                  placeholder={t("students.detail.tagPlaceholder")} className="b-input !h-8 !text-[12px] !w-24 !px-2" autoFocus />
                <button onClick={addTag} className="b-btn b-btn-ghost text-spring-deep"><CheckCircle2 className="w-4 h-4" /></button>
              </span>
            ) : (
              <button onClick={() => setShowTagInput(true)} className="b-badge b-badge-neutral hover:bg-spring-tint cursor-pointer"><Plus className="w-3 h-3" /> {t("students.detail.tagAdd")}</button>
            )
          )}
        </div>
      </div>

      {/* تب‌ها */}
      <div role="tablist" className="flex gap-1.5 mb-6 overflow-x-auto b-scroll pb-1">
        {([
          ["overview", t("students.detail.tab.overview")], ["timeline", t("students.detail.tab.timeline")], ["docs", `${t("students.detail.tab.docs")} (${faNumber(student.documents.filter((d) => d.status === "RECEIVED").length)}/${faNumber(DOC_KINDS.length)})`],
          ["goals", `${t("students.detail.goals")} (${faNumber(student.goals.filter((g) => g.status === "ACTIVE").length)})`], ["portfolio", `${t("nav.portfolio")} (${faNumber(student.portfolioItems.length)})`],
        ] as const).map(([k, label]) => (
          <button role="tab" aria-selected={tab === k} key={k} onClick={() => setTab(k)} className={`b-pill-tab ${tab === k ? "b-pill-tab-active" : ""}`}>{label}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>

          {tab === "overview" && (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="b-card-md p-5">
                <h3 className="font-bold mb-4">{t("students.detail.trackingStatus")}</h3>
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative w-20 h-20">
                    <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="var(--hairline-soft)" strokeWidth="8" />
                      <circle cx="40" cy="40" r="34" fill="none" stroke={riskColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(analytics.risk.score / 100) * 213.6} 213.6`} />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-lg font-bold" style={{ color: riskColor }}>{faNumber(analytics.risk.score)}</span>
                  </div>
                  <div>
                    <p className="font-bold text-[14px]" style={{ color: riskColor }}>{riskTKey ? t(riskTKey) : ""}</p>
                    <p className="text-[12px] text-steel">{t("students.detail.trackingIndex")}</p>
                  </div>
                </div>
                {analytics.risk.reasons.length > 0 && (
                  <ul className="flex flex-col gap-1.5">
                    {analytics.risk.reasons.map((r, i) => (
                      <li key={i} className="flex items-center gap-2 text-[12px] text-steel"><AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />{r}</li>
                    ))}
                  </ul>
                )}
                {analytics.patterns.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-hairline-soft">
                    <p className="text-[12px] font-bold mb-1.5">{t("students.detail.absencePattern")}</p>
                    {analytics.patterns.map((p, i) => <p key={i} className="text-[12px] text-steel">• {p}</p>)}
                  </div>
                )}
              </div>

              <div className="b-card-md p-5 lg:col-span-2">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <MiniCard label={t("dashboard.gpa")} value={analytics.gpa ? faNumber(analytics.gpa) : "—"} delta={analytics.trend} />
                  <MiniCard label={t("dashboard.mini.attendance")} value={analytics.attendanceRate ? `${faNumber(analytics.attendanceRate)}٪` : "—"} />
                  <MiniCard label={t("dashboard.mini.absence")} value={faNumber(analytics.absences)} />
                  <MiniCard label={t("dashboard.behaviorPoints")} value={faNumber(analytics.behaviorPoints)} />
                </div>
                <h3 className="font-bold mb-3">{t("students.detail.subjectPerformance")}</h3>
                <BarChart data={data.subjectBreakdown.slice(0, 8).map((s) => ({ label: s.name, value: s.avg }))} max={20} />
              </div>

              <div className="b-card-md p-5 lg:col-span-3">
                <h3 className="font-bold mb-4">{t("students.parents.title")}</h3>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {student.parents.map((p, i) => (
                    <div key={i} className="p-3.5 rounded-2xl bg-cloud flex items-center gap-3">
                      <UserAvatar user={{ ...p.parentUser, avatar: p.parentUser.avatar ?? null }} size={40} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold truncate">{p.parentUser.firstName} {p.parentUser.lastName}</p>
                        <p className="text-[12px] text-steel truncate">{p.relation === "FATHER" ? t("dashboard.relation.father") : p.relation === "MOTHER" ? t("dashboard.relation.mother") : t("dashboard.relation.guardian")}{p.parentUser.jobTitle ? ` · ${p.parentUser.jobTitle}` : ""}</p>
                      </div>
                      {p.parentUser.phone && <span className="text-[12px] text-steel shrink-0">{faNumber(p.parentUser.phone)}</span>}
                    </div>
                  ))}
                  {student.parents.length === 0 && <p className="t-sm text-steel">{t("students.detail.noParents")}</p>}
                </div>
              </div>
            </div>
          )}

          {tab === "timeline" && (
            <div className="b-card-md p-5">
              <h3 className="font-bold mb-5">{t("students.detail.timelineTitle")}</h3>
              {data.timeline.length === 0 ? <p className="t-sm text-steel text-center py-8">{t("students.detail.timelineEmpty")}</p> : (
                <div className="relative ps-4">
                  <span className="absolute top-0 bottom-0 start-[7px] w-0.5 bg-hairline-soft" />
                  <StaggerGroup step={30} className="flex flex-col gap-4">
                    {data.timeline.map((ev, i) => {
                      const Icon = TONE_ICON[ev.tone] ?? Clock;
                      return (
                        <StaggerItem key={i}>
                          <div className="relative flex items-start gap-3">
                            <span className={`absolute -start-4 top-1 w-4 h-4 rounded-full border-2 border-background ${ev.tone === "POSITIVE" ? "bg-success" : ev.tone === "NEGATIVE" ? "bg-destructive" : "bg-stone"}`} />
                            <div className="flex-1 flex items-center gap-3 flex-wrap">
                              <Icon className={`w-4 h-4 shrink-0 ${ev.tone === "POSITIVE" ? "text-success" : ev.tone === "NEGATIVE" ? "text-destructive" : "text-stone"}`} />
                              <span className="text-[12px] font-bold">{ev.title}</span>
                              {ev.detail && <span className="text-[12px] text-steel">{ev.detail}</span>}
                              <span className="text-[12px] text-stone ms-auto">{relativeTimeFa(ev.at)}</span>
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </StaggerGroup>
                </div>
              )}
            </div>
          )}

          {tab === "docs" && (
            <div className="b-card-md p-5">
              <h3 className="font-bold mb-2">{t("students.detail.docsTitle")}</h3>
              <p className="t-sm text-steel mb-5">{t("students.detail.docsDesc")}</p>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {DOC_KINDS.map(([kind, tkey]) => {
                  const doc = student.documents.find((d) => d.kind === kind);
                  const status = doc?.status ?? "PENDING";
                  const expiring = doc?.expiresAt && new Date(doc.expiresAt).getTime() - Date.now() < 30 * 86400000;
                  return (
                    <div key={kind} className={`p-3.5 rounded-2xl border flex items-center gap-3 ${status === "RECEIVED" ? "bg-spring-tint/40 border-spring/20" : status === "REJECTED" ? "bg-destructive/5 border-destructive/20" : "bg-cloud border-transparent"}`}>
                      <FileCheck className={`w-5 h-5 shrink-0 ${status === "RECEIVED" ? "text-spring-deep" : "text-stone"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-bold">{t(tkey)}</p>
                        <p className="text-[12px] text-steel">
                          {status === "RECEIVED" ? `${t("students.detail.doc.received")}${doc?.receivedAt ? " — " + formatDateFa(doc.receivedAt) : ""}` : status === "REJECTED" ? t("profile.requests.rejected") : t("students.detail.doc.pending")}
                          {expiring && <span className="text-destructive font-bold"> · {t("students.detail.doc.expiring")}</span>}
                        </p>
                      </div>
                      {data.canEdit && (
                        <div className="flex gap-1 shrink-0">
                          {status !== "RECEIVED" && (
                            <button onClick={() => setDoc(kind, "RECEIVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2.5 !py-0.5">{t("students.detail.doc.received")}</button>
                          )}
                          {status === "RECEIVED" && (
                            <button onClick={() => setDoc(kind, "PENDING")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2.5 !py-0.5">{t("enum.kindFa.REFUND")}</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "goals" && (
            <GoalsTab studentId={id} canEdit={data.canEdit} goals={student.goals} interventions={student.interventions} analytics={analytics} reload={load} />
          )}

          {tab === "portfolio" && (
            <PortfolioTab studentId={id} canEdit={data.canEdit} items={student.portfolioItems} reload={load} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Tag; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-stone shrink-0" />
      <span className="text-steel shrink-0">{label}:</span>
      <span className="font-bold truncate">{value}</span>
    </div>
  );
}

function MiniCard({ label, value, delta }: { label: string; value: string; delta?: number }) {
  return (
    <div className="p-3 rounded-2xl bg-cloud text-center">
      <p className="text-[12px] text-steel">{label}</p>
      <p className="text-[16px] font-bold">{value}</p>
      {delta !== undefined && delta !== 0 && (
        <p className={`text-[12px] font-bold flex items-center justify-center gap-0.5 ${delta > 0 ? "text-success" : "text-destructive"}`}>
          {delta > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {faNumber(Math.abs(delta))}
        </p>
      )}
    </div>
  );
}

function GoalsTab({ studentId, canEdit, goals, interventions, analytics, reload }: {
  studentId: string; canEdit: boolean;
  goals: Data360["student"]["goals"];
  interventions: Data360["student"]["interventions"];
  analytics: Data360["analytics"];
  reload: () => void;
}) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [ivDesc, setIvDesc] = useState("");
  const [showIv, setShowIv] = useState(false);
  const { t } = useLang();

  async function addGoal() {
    if (!title.trim()) return;
    try {
      await apiPatch(`/api/students/${studentId}/360`, { op: "goal", title, metric: "GPA", targetValue: target || null });
      setTitle(""); setTarget(""); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("students.detail.toast.goalFailed")); }
  }
  async function addIntervention() {
    if (!ivDesc.trim()) return;
    try {
      await apiPatch(`/api/students/${studentId}/360`, { op: "intervention", kind: "MEETING", description: ivDesc });
      setIvDesc(""); setShowIv(false); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("students.detail.toast.interventionFailed")); }
  }
  async function resolveIv(id: string) {
    try {
      await apiPatch(`/api/students/${studentId}/360`, { op: "intervention-resolve", interventionId: id, outcome: "خاتمه یافت" });
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }
  async function goalStatus(gid: string, status: string) {
    try {
      await apiPatch(`/api/students/${studentId}/360`, { op: "goal-status", goalId: gid, status, currentValue: status === "ACHIEVED" ? (analytics.gpa?.toString() ?? "") : undefined });
      reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="b-card-md p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-spring" /> {t("students.detail.goals")}</h3>
        {canEdit && (
          <div className="flex gap-2 mb-4">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("students.detail.goalPlaceholder")} className="b-input !h-10 flex-1" />
            <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder={t("students.detail.goalTargetPlaceholder")} className="b-input !h-10 !w-24" />
            <button onClick={addGoal} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /></button>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {goals.map((g) => (
            <div key={g.id} className={`p-3.5 rounded-2xl border ${g.status === "ACHIEVED" ? "bg-spring-tint/40 border-spring/20" : g.status === "ACTIVE" ? "bg-cloud border-transparent" : "opacity-50 bg-cloud border-transparent"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[14px] font-bold flex-1">{g.title}</span>
                {g.targetValue && <span className="b-badge b-badge-neutral">{t("students.detail.goalTargetPrefix")} {faNumber(g.targetValue)}</span>}
                {g.currentValue && <span className="b-badge b-badge-spring">{t("exams.invigilators.current")} {faNumber(g.currentValue)}</span>}
                {g.status === "ACTIVE" && canEdit && (
                  <>
                    <button onClick={() => goalStatus(g.id, "ACHIEVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px] !px-2.5 !py-0.5">{t("students.detail.goalAchieved")}</button>
                    <button onClick={() => goalStatus(g.id, "DROPPED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2.5 !py-0.5">{t("students.detail.goalDropped")}</button>
                  </>
                )}
              </div>
              {g.dueDate && <p className="text-[12px] text-steel mt-1">{t("common.to")} {formatDateFa(g.dueDate)}</p>}
            </div>
          ))}
          {goals.length === 0 && <p className="t-sm text-steel text-center py-4">{t("students.detail.goalsEmpty")}</p>}
        </div>
      </div>
      <div className="b-card-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blossom" /> {t("students.detail.interventionsTitle")}</h3>
          {canEdit && !showIv && <button onClick={() => setShowIv(true)} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px]"><Plus className="w-3.5 h-3.5" /> {t("students.detail.interventionAdd")}</button>}
        </div>
        {showIv && (
          <div className="mb-4 flex gap-2">
            <input value={ivDesc} onChange={(e) => setIvDesc(e.target.value)} placeholder={t("students.detail.interventionPlaceholder")} className="b-input !h-10 flex-1" autoFocus />
            <button onClick={addIntervention} className="b-btn b-btn-sm b-btn-spring">{t("behavior.submit")}</button>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          {interventions.map((iv) => (
            <div key={iv.id} className={`p-3.5 rounded-2xl ${iv.status === "ACTIVE" ? "bg-blossom-tint/60" : "bg-cloud"}`}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`b-badge ${iv.status === "ACTIVE" ? "b-badge-blossom" : "b-badge-neutral"}`}>{iv.status === "ACTIVE" ? t("tasks.status.inProgress") : t("students.detail.interventionClosed")}</span>
                <span className="text-[12px] text-steel">{iv.startedBy.firstName} {iv.startedBy.lastName}</span>
                {iv.status === "ACTIVE" && canEdit && (
                  <button onClick={() => resolveIv(iv.id)} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] ms-auto !px-2.5 !py-0.5">{t("students.detail.interventionResolve")}</button>
                )}
              </div>
              <p className="text-[12px] mt-1.5 leading-relaxed">{iv.description}</p>
              {iv.outcome && <p className="text-[12px] text-steel mt-1">{t("students.detail.interventionOutcome")} {iv.outcome}</p>}
            </div>
          ))}
          {interventions.length === 0 && <p className="t-sm text-steel text-center py-4">{t("students.detail.interventionsEmpty")}</p>}
        </div>
      </div>
    </div>
  );
}

function PortfolioTab({ studentId, canEdit, items, reload }: {
  studentId: string; canEdit: boolean;
  items: Data360["student"]["portfolioItems"];
  reload: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("PROJECT");
  const { t } = useLang();
  const KINDS: Array<[string, string]> = [["PROJECT", "enum.gradeKind.PROJECT"], ["CERTIFICATE", "certificates.fallbackTitle"], ["COMPETITION", "students.detail.portfolio.competition"], ["ARTWORK", "students.detail.portfolio.artwork"], ["ACHIEVEMENT", "students.detail.portfolio.achievement"], ["SKILL", "students.detail.portfolio.skill"]];
  const kindLabel = (k: string) => { const f = KINDS.find(([code]) => code === k); return f ? t(f[1]) : k; };
  async function addItem() {
    if (!title.trim()) return;
    try {
      await apiPatch(`/api/students/${studentId}/360`, { op: "portfolio", itemKind: kind, title });
      setTitle(""); reload();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("students.detail.toast.portfolioFailed")); }
  }
  return (
    <div className="b-card-md p-5">
      <h3 className="font-bold mb-4 flex items-center gap-2"><Briefcase className="w-4 h-4 text-spring" /> {t("students.detail.portfolioTitle")}</h3>
      {canEdit && (
        <div className="flex flex-wrap gap-2 mb-5">
          <Select
            value={kind}
            onChange={(v) => setKind(v)}
            options={KINDS.map(([k, tk]) => ({ value: k, label: t(tk) }))}
            className="!w-32"
            buttonClassName="!h-10 !w-32"
          />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("students.detail.portfolioTitlePlaceholder")} className="b-input !h-10 flex-1 min-w-[180px]" onKeyDown={(e) => e.key === "Enter" && addItem()} />
          <button onClick={addItem} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> {t("common.add")}</button>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it, i) => (
          <motion.div key={it.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="p-4 rounded-2xl bg-cloud flex flex-col gap-1.5">
            <span className="b-badge b-badge-spring w-fit">{kindLabel(it.kind)}</span>
            <p className="text-[14px] font-bold">{it.title}</p>
            {it.description && <p className="text-[12px] text-steel line-clamp-2">{it.description}</p>}
            {it.url && <a href={it.url} target="_blank" rel="noreferrer" className="text-[12px] text-spring-deep hover:underline">{t("students.detail.portfolioViewLink")}</a>}
            {it.date && <p className="text-[12px] text-stone">{formatDateFa(it.date)}</p>}
          </motion.div>
        ))}
        {items.length === 0 && <p className="t-sm text-steel col-span-full text-center py-8">{t("students.detail.portfolioEmpty")}</p>}
      </div>
    </div>
  );
}
