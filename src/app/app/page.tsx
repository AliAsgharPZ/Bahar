"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ClipboardCheck, BarChart3, BellPlus, Send, GraduationCap, Plus,
  LifeBuoy, ClipboardList, CalendarOff, Handshake, Wrench, Wallet, ListTodo,
  FileCheck, CheckCheck, Sparkles, TrendingUp, TrendingDown, ChevronDown,
  HeartPulse, School as SchoolIcon, Users, MessageCircle, NotebookPen, Vote,
  Award, Cake, AlertTriangle, CheckCircle2, Info, ArrowLeft, X, Printer,
  Settings, History,
} from "lucide-react";
import { apiGet } from "@/lib/client";
import { useLang } from "@/lib/i18n";
import { faNumber, faDigits, formatDateFa, relativeTimeFa, currencyLabel, jalaliParts } from "@/lib/persian";
import { PageHeader, StatCard, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { LineChart, BarChart, DonutChart, VBarChart, RadialGauge } from "@/components/shared/charts";
import { StaggerGroup, StaggerItem, CountUp } from "@/components/shared/motion";

/* ============================================================
   بهار | داشبورد نقش‌محور — مرکز اقدامات + بینش + چارت
   ============================================================ */

type Dash = Record<string, unknown> & { scope: string };

const ICONS: Record<string, typeof LifeBuoy> = {
  LifeBuoy, ClipboardList, CalendarOff, Handshake, Wrench, Wallet, ListTodo, FileCheck, CheckCheck, ClipboardCheck, MessageCircle, Vote,
};

const SEV_STYLE: Record<string, string> = {
  URGENT: "border-s-4 !border-s-destructive",
  IMPORTANT: "border-s-4 !border-s-warning",
  NORMAL: "border-s-4 !border-s-info",
};

const ROLE_TKEY: Record<string, string> = {
  SUPER_ADMIN: "role.superAdmin",
  ADMIN: "role.admin",
  MANAGER: "role.manager",
  DEPUTY: "role.deputy",
  TEACHER: "role.teacher",
  CUSTODIAN: "role.custodian",
  STUDENT: "role.student",
  PARENT: "role.parent",
};

export default function DashboardPage() {
  const { t } = useLang();
  const [data, setData] = useState<Dash | null>(null);
  type ACItem = { key: string; title: string; description: string; count: number; href: string; severity: string; icon: string };
  const [actionCenter, setActionCenter] = useState<{ items: ACItem[]; needsAttention: ACItem[] } | null>(null);
  const [error, setError] = useState("");
  const [whyOpen, setWhyOpen] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Dash>("/api/dashboard").then((d) => { setData(d); }).catch((e) => setError(e.message));
    apiGet<{ items: ACItem[]; needsAttention: ACItem[] }>("/api/action-center").then(setActionCenter).catch(() => setActionCenter({ items: [], needsAttention: [] }));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data || !actionCenter) return <LoadingBlock label={t("dashboard.loading")} />;

  return (
    <div>
      <PageHeader title={greeting(t)} desc={subTitle(data, t)} grad />

      {/* ═══ مرکز اقدامات ═══ */}
      {(actionCenter.items.length > 0 || actionCenter.needsAttention.length > 0) && (
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-destructive b-pulse-dot" />
            <h2 className="text-[16px] font-bold">{t("dashboard.attentionNeeded")}</h2>
            <span className="b-badge b-badge-critical">{faNumber(actionCenter.needsAttention.length)} {t("dashboard.urgent")}</span>
          </div>
          <StaggerGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {actionCenter.items.slice(0, 6).map((it) => {
              const Icon = ICONS[it.icon] ?? ListTodo;
              return (
                <StaggerItem key={it.key}>
                  <Link
                    href={it.href}
                    className={`b-card-sm p-4 flex items-center gap-3.5 hover:shadow-md transition-shadow group ${SEV_STYLE[it.severity] ?? ""}`}
                  >
                    <span className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${it.severity === "URGENT" ? "bg-destructive/10 text-destructive" : it.severity === "IMPORTANT" ? "bg-warning/15 text-warning-deep" : "bg-spring-tint text-spring-deep"}`}>
                      <Icon className="w-5 h-5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="text-[14px] font-bold truncate">{it.title}</span>
                        {it.count > 0 && <span className="b-badge b-badge-neutral !text-[12px]">{faNumber(it.count)}</span>}
                      </span>
                      <span className="block text-[12px] text-steel truncate">{it.description}</span>
                    </span>
                    <ArrowLeft className="w-4 h-4 text-stone group-hover:-translate-x-1 group-hover:text-spring transition-all flip-rtl" />
                  </Link>
                </StaggerItem>
              );
            })}
          </StaggerGroup>
        </section>
      )}

      {data.scope === "service" && <ServiceDashboard data={data} />}
      {data.scope === "school" && <ManagerDashboard data={data} why={whyOpen} setWhy={setWhyOpen} />}
      {data.scope === "teacher" && <TeacherDashboard data={data} />}
      {data.scope === "student" && <StudentDashboard data={data} />}
      {data.scope === "parent" && <ParentDashboard data={data} />}
      {data.scope === "none" && (
        <EmptyState icon={SchoolIcon} title={t("dashboard.welcomeNone")} desc={t("dashboard.noSchoolYet")} />
      )}

    </div>
  );
}

function greeting(t: (k: string) => string): string {
  const h = new Date().getHours();
  return h < 12 ? t("dashboard.greet.morning") : h < 17 ? t("dashboard.greet.afternoon") : t("dashboard.greet.night");
}
function subTitle(d: Dash, t: (k: string) => string): string {
  const today = d.today as string | undefined;
  // FIX (راند ۱۶): «همین حالا» بی‌معنی حذف شد
  return today ? `${t("dashboard.today")} ${formatDateFa(new Date())}` : t("dashboard.systemSummary");
}

/* ═══════════ داشبورد سرویس (سوپرادمین) — کامل: سیستم + آمار + چارت‌ها ═══════════ */

function fmtSize(bytes: number | null, t: (k: string) => string): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${faNumber(bytes)} ${t("dashboard.unit.byte")}`;
  if (bytes < 1048576) return `${faNumber(Math.round(bytes / 1024))} ${t("dashboard.unit.kb")}`;
  return `${faDigits((bytes / 1048576).toFixed(1))} ${t("dashboard.unit.mb")}`;
}
function fmtUptime(sec: number, t: (k: string) => string): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${faNumber(d)} ${t("dashboard.uptime.day")} ${t("dashboard.uptime.and")} ${faNumber(h)} ${t("dashboard.uptime.hour")}`;
  if (h > 0) return `${faNumber(h)} ${t("dashboard.uptime.hour")} ${t("dashboard.uptime.and")} ${faNumber(m)} ${t("dashboard.uptime.minute")}`;
  return `${faNumber(m)} ${t("dashboard.uptime.minute")}`;
}

function ServiceDashboard({ data }: { data: Dash }) {
  const { t, lang } = useLang();
  const isRtl = lang.direction !== "ltr";
  const s = data.stats as Record<string, unknown>;
  const growth = (data.schoolGrowth as Array<{ month: string; count: number }>) ?? [];
  const wc = (data.whatChanged as Record<string, number>) ?? {};
  const sys = (data.system ?? {}) as { nodeVersion?: string; uptimeSec?: number; memoryMb?: number; platform?: string; dbSizeBytes?: number | null; env?: string };
  const usersByRole = (data.usersByRole as Array<{ role: string; count: number }>) ?? [];
  const loginTrend = (data.loginTrend as Array<{ date: string; success: number; failed: number }>) ?? [];
  const ticketsByStatus = (data.ticketsByStatus as Array<{ status: string; count: number }>) ?? [];
  const recentSignups = (data.recentSignups as Array<{ id: string; firstName: string; lastName: string; role: string; createdAt: string; school?: { name: string } | null }>) ?? [];
  const topSchools = (data.topSchools as Array<{ id: string; name: string; students: number }>) ?? [];
  const usersGrowth = (data.usersGrowth as Array<{ month: string; count: number }>) ?? [];
  const studentsGrowth = (data.studentsGrowth as Array<{ month: string; count: number }>) ?? [];
  const allSchools = (data.allSchools as Array<{ id: string; name: string; students: number; teachers: number; classes: number }>) ?? [];
  const backup = s.backup as { at: string; kind: string; filename: string } | null | undefined;
  type AuditRow = { id: string; action: string; entityType: string; createdAt: string; user?: { firstName: string; lastName: string } | null };
  const auditRows = (data.recentAudit as AuditRow[] | undefined) ?? [];

  const failed7 = loginTrend.reduce((a, b) => a + b.failed, 0);
  const success7 = loginTrend.reduce((a, b) => a + b.success, 0);
  const failRatio = success7 + failed7 > 0 ? Math.round((failed7 / (success7 + failed7)) * 100) : 0;
  const backupAgeHrs = backup ? Math.round((Date.now() - new Date(backup.at).getTime()) / 3600000) : null;

  // سلامت کلی سرویس — ترکیب بکاپ/خطای ورود/تیکت باز
  const health =
    (backupAgeHrs !== null && backupAgeHrs > 48 ? 0 : 25) +
    (failRatio < 10 ? 25 : failRatio < 30 ? 15 : 5) +
    (Number(s.openTickets ?? 0) < 5 ? 25 : Number(s.openTickets ?? 0) < 15 ? 15 : 5) +
    25 /* هسته در حال اجرا */;

  const QUICK = [
    { href: "/app/schools", label: t("nav.schools"), icon: SchoolIcon },
    { href: "/app/users", label: t("nav.users"), icon: Users },
    { href: "/app/tickets", label: t("nav.tickets"), icon: LifeBuoy },
    { href: "/app/settings", label: t("settings.title"), icon: Settings },
    { href: "/app/blog", label: t("nav.blog"), icon: MessageCircle },
    { href: "/app/audit", label: t("nav.audit"), icon: History },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* ردیف وضعیت سیستم */}
      <div className="b-card-md p-4 md:p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h3 className="font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-success b-pulse-dot" />
            {t("dashboard.systemStatus")}
          </h3>
          <span className="b-badge b-badge-success">{t("shell.online")} · {sys.env === "production" ? t("dashboard.env.production") : t("dashboard.env.development")}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <SysChip label={t("dashboard.sys.nodeVersion")} value={sys.nodeVersion ?? "—"} />
          <SysChip label={t("dashboard.sys.uptime")} value={fmtUptime(sys.uptimeSec ?? 0, t)} />
          <SysChip label={t("dashboard.sys.memory")} value={`${faNumber(sys.memoryMb ?? 0)} MB`} />
          <SysChip label={t("dashboard.sys.dbSize")} value={fmtSize(sys.dbSizeBytes ?? null, t)} />
          <SysChip label={t("dashboard.sys.platform")} value={sys.platform ?? "—"} />
          <SysChip
            label={t("dashboard.sys.lastBackup")}
            value={backup ? relativeTimeFa(backup.at) : "—"}
            tone={backupAgeHrs !== null && backupAgeHrs > 48 ? "warning" : "spring"}
          />
        </div>
      </div>

      {/* آمار کلیدی */}
      <StaggerGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard icon={SchoolIcon} label={t("dashboard.schoolsActive")} value={<CountUp value={Number(s.schools ?? 0)} />} hint={wc.newUsers ? `${faNumber(wc.newUsers)}+ ${t("dashboard.hint.newUsers")}` : undefined} /></StaggerItem>
        <StaggerItem><StatCard icon={Users} label={t("nav.users")} value={<CountUp value={Number(s.users ?? 0)} />} tone="ink" hint={`${faNumber(Number(s.logins24h ?? 0))} ${t("dashboard.hint.logins24h")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={GraduationCap} label={t("nav.students")} value={<CountUp value={Number(s.students ?? 0)} />} tone="blossom" hint={`${faNumber(Number(s.classes ?? 0))} ${t("dashboard.hint.activeClasses")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={LifeBuoy} label={t("dashboard.openTickets")} value={<CountUp value={Number(s.openTickets ?? 0)} />} tone="warning" hint={`${faNumber(Number(s.messages ?? 0))} ${t("dashboard.hint.messages")} · ${faNumber(Number(s.notifications ?? 0))} ${t("dashboard.hint.notifications")}`} /></StaggerItem>
      </StaggerGroup>

      {/* ردیف دوم آمار — فیلدهایی که API برمی‌گرداند ولی نمایش داده نمی‌شدند */}
      <StaggerGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard icon={Users} label={t("dashboard.teachers")} value={<CountUp value={Number(s.teachers ?? 0)} />} tone="soft" /></StaggerItem>
        <StaggerItem><StatCard icon={MessageCircle} label={t("dashboard.blogPosts")} value={<CountUp value={Number(s.blogPosts ?? 0)} />} tone="blossom" /></StaggerItem>
        <StaggerItem><StatCard icon={Send} label={t("dashboard.shadSent")} value={<CountUp value={Number(s.shadSent ?? 0)} />} tone="ink" /></StaggerItem>
        <StaggerItem><StatCard icon={BellPlus} label={t("shell.notifications")} value={<CountUp value={Number(s.notifications ?? 0)} />} tone="warning" hint={`${faNumber(Number(s.messages ?? 0))} ${t("dashboard.hint.messages")}`} /></StaggerItem>
      </StaggerGroup>

      {/* چارت‌های اصلی */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="b-card-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.growthSchools")}</h3>
            <span className="b-badge b-badge-neutral">{t("common.total")} {faNumber(Number(s.schools ?? 0))} {t("common.school")}</span>
          </div>
          <LineChart
            data={growth.map((g) => ({
              label: t(`dashboard.month.${jalaliParts(new Date(`${g.month}-15`)).m}`) ?? g.month,
              value: g.count,
            }))}
            height={150}
          />
        </div>
        <div className="b-card-md p-5 flex flex-col items-center justify-center gap-3">
          <h3 className="font-bold self-start">{t("dashboard.serviceHealth")}</h3>
          <RadialGauge value={health} size={116} label={t("dashboard.outOf100")} />
          <div className="w-full flex flex-col gap-1.5 text-[12px]">
            <HealthMiniRow label={t("dashboard.health.backup")} ok={backupAgeHrs !== null && backupAgeHrs <= 48} okText={t("dashboard.health.upToDate")} badText={backupAgeHrs === null ? t("dashboard.health.noBackup") : t("dashboard.health.stale")} />
            <HealthMiniRow label={t("dashboard.health.failedLogins")} ok={failRatio < 10} okText={`${faNumber(failRatio)}٪`} badText={`${faNumber(failRatio)}٪ ${t("dashboard.health.ofTotal")}`} />
            <HealthMiniRow label={t("dashboard.openTickets")} ok={Number(s.openTickets ?? 0) < 5} okText={`${faNumber(Number(s.openTickets ?? 0))} ${t("dashboard.unit.case")}`} badText={`${faNumber(Number(s.openTickets ?? 0))} ${t("dashboard.unit.case")}`} />
            <HealthMiniRow label={t("dashboard.health.core")} ok okText={t("dashboard.health.running")} badText="" />
          </div>
        </div>
      </div>

      {/* رشد کاربران و دانش‌آموزان (۱۲ ماه اخیر، انباشته) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="b-card-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.growthUsers")}</h3>
            <span className="b-badge b-badge-neutral">{t("common.total")} {faNumber(Number(s.users ?? 0))} {t("dashboard.unit.user")}</span>
          </div>
          <LineChart
            data={usersGrowth.map((g) => ({
              label: t(`dashboard.month.${jalaliParts(new Date(`${g.month}-15`)).m}`) ?? g.month,
              value: g.count,
            }))}
            height={150}
          />
        </div>
        <div className="b-card-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.growthStudents")}</h3>
            <span className="b-badge b-badge-neutral">{t("common.total")} {faNumber(Number(s.students ?? 0))} {t("common.student")}</span>
          </div>
          <LineChart
            data={studentsGrowth.map((g) => ({
              label: t(`dashboard.month.${jalaliParts(new Date(`${g.month}-15`)).m}`) ?? g.month,
              value: g.count,
            }))}
            height={150}
            color="var(--blossom)"
          />
        </div>
      </div>

      {/* نقش‌ها + ورودها */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.usersByRole")}</h3>
          <DonutChart
            parts={usersByRole.map((r, i) => ({
              label: ROLE_TKEY[r.role] ? t(ROLE_TKEY[r.role]) : r.role,
              value: r.count,
              color: ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)", "var(--chart-5)", "var(--chart-5)", "var(--chart-2)"][i % 7],
            }))}
            centerLabel={t("dashboard.unit.user")}
          />
        </div>
        <div className="b-card-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.logins7d")}</h3>
            <span className="flex gap-1.5">
              <span className="b-badge b-badge-spring">{t("dashboard.login.success")} {faNumber(success7)}</span>
              <span className="b-badge b-badge-critical">{t("dashboard.login.failed")} {faNumber(failed7)}</span>
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <span className="text-[12px] text-steel block mb-1.5">{t("dashboard.logins.successDaily")}</span>
              <VBarChart data={loginTrend.map((t) => ({ label: t.date.slice(5), value: t.success }))} height={110} color="var(--spring)" />
            </div>
            <div>
              <span className="text-[12px] text-steel block mb-1.5">{t("dashboard.logins.failedDaily")}</span>
              <VBarChart data={loginTrend.map((t) => ({ label: t.date.slice(5), value: t.failed }))} height={90} color="var(--destructive)" idSuffix="-f" />
            </div>
          </div>
        </div>
      </div>

        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.topSchools")}</h3>
          {topSchools.length === 0 ? (
            <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noSchool")}</p>
          ) : (
            <BarChart data={topSchools.map((t) => ({ label: t.name, value: t.students }))} max={Math.max(...topSchools.map((t) => t.students), 1)} suffix={` ${t("dashboard.unit.person")}`} />
          )}
        </div>

      {/* جدول همهٔ مدارس فعال */}
      <div className="b-card-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">{t("dashboard.allActiveSchools")}</h3>
          <Link href="/app/schools" className="text-[12px] font-bold text-spring-deep hover:underline">{t("dashboard.manageSchools")}</Link>
        </div>
        {allSchools.length === 0 ? (
          <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noSchool")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-steel text-start border-b border-hairline-soft">
                  <th className="text-start font-bold py-2 pe-3">{t("common.school")}</th>
                  <th className="text-start font-bold py-2 pe-3">{t("common.student")}</th>
                  <th className="text-start font-bold py-2 pe-3">{t("common.teacher")}</th>
                  <th className="text-start font-bold py-2">{t("common.class")}</th>
                </tr>
              </thead>
              <tbody>
                {allSchools.map((sc) => (
                  <tr key={sc.id} className="border-b border-hairline-soft/60 last:border-0 hover:bg-spring-tint/40 transition-colors">
                    <td className="py-2.5 pe-3 font-bold">
                      <Link href="/app/schools" className="hover:underline hover:text-spring-deep">{sc.name}</Link>
                    </td>
                    <td className="py-2.5 pe-3">{faNumber(sc.students)}</td>
                    <td className="py-2.5 pe-3">{faNumber(sc.teachers)}</td>
                    <td className="py-2.5">{faNumber(sc.classes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* آخرین ثبت‌نام‌ها + تیکت‌ها */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="b-card-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.recentSignups")}</h3>
            <Link href="/app/users" className="text-[12px] font-bold text-spring-deep hover:underline">{t("dashboard.allUsers")}</Link>
          </div>
          {recentSignups.length === 0 ? (
            <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noUser")}</p>
          ) : (
            <div className="flex flex-col gap-1">
              {recentSignups.map((u, i) => (
                <motion.div key={u.id} initial={{ opacity: 0, x: isRtl ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-spring-tint/40 transition-colors">
                  <span className="w-8 h-8 rounded-full bg-spring-tint text-spring-deep text-[12px] font-bold flex items-center justify-center shrink-0">
                    {u.firstName?.[0] ?? "؟"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="text-[12px] font-bold truncate block">{u.firstName} {u.lastName}</span>
                    <span className="text-[12px] text-steel truncate block">{ROLE_TKEY[u.role] ? t(ROLE_TKEY[u.role]) : u.role}{u.school?.name ? ` · ${u.school.name}` : ""}</span>
                  </span>
                  <span className="text-[12px] text-stone shrink-0">{relativeTimeFa(u.createdAt)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.ticketsByStatus")}</h3>
          {ticketsByStatus.length === 0 ? (
            <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noTicket")}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {ticketsByStatus.map((tk) => (
                <div key={tk.status} className="flex items-center justify-between text-[12px] px-3 py-2 rounded-2xl bg-cloud/60">
                  <span className="flex items-center gap-2">
                    <span className={`b-dot ${tk.status === "OPEN" ? "bg-destructive" : tk.status === "CLOSED" ? "bg-success" : "bg-warning"}`} />
                    <span className="font-bold">{tk.status === "OPEN" ? t("dashboard.ticket.open") : tk.status === "ANSWERED" ? t("dashboard.ticket.answered") : tk.status === "CLOSED" ? t("dashboard.ticket.closed") : tk.status}</span>
                  </span>
                  <b>{faNumber(tk.count)}</b>
                </div>
              ))}
            </div>
          )}
          <h3 className="font-bold mt-5 mb-3">{t("dashboard.quickActions")}</h3>
          <div className="grid grid-cols-3 gap-2">
            {QUICK.map((q) => (
              <Link key={q.href} href={q.href} className="flex flex-col items-center gap-1.5 rounded-2xl p-3 text-center text-[12px] font-bold text-steel hover:bg-spring-tint hover:text-spring-deep transition-colors">
                <q.icon className="w-5 h-5" />
                {q.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* آخرین رویدادهای امنیتی */}
      <div className="b-card-md p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold flex items-center gap-2"><History className="w-4 h-4 text-steel" /> {t("dashboard.recentAudit")}</h3>
          <Link href="/app/audit" className="text-[12px] font-bold text-spring-deep hover:underline">{t("dashboard.fullReport")}</Link>
        </div>
        {auditRows.length === 0 ? (
          <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noAudit")}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {auditRows.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-2 py-1.5 rounded-2xl text-[12px] hover:bg-spring-tint/40 transition-colors">
                <span className="b-badge b-badge-neutral !text-[12px] !px-2 !py-0.5 shrink-0">{a.action}</span>
                <span className="text-steel truncate flex-1">
                  {a.user?.firstName ? `${a.user.firstName} ${a.user.lastName ?? ""}` : t("dashboard.system")} · {a.entityType}
                </span>
                <span className="text-stone text-[12px] shrink-0">{relativeTimeFa(a.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SysChip({ label, value, tone = "spring" }: { label: string; value: string; tone?: "spring" | "warning" }) {
  return (
    <div className={`rounded-2xl px-3 py-2.5 border ${tone === "warning" ? "bg-warning/10 border-warning/20" : "bg-spring-tint/40 border-spring/15"}`}>
      <span className="block text-[12px] text-steel mb-0.5">{label}</span>
      <span className={`text-[12px] font-bold ${tone === "warning" ? "text-warning-deep" : "text-spring-deep"} truncate block`} title={value}>{value}</span>
    </div>
  );
}

function HealthMiniRow({ label, ok, okText, badText }: { label: string; ok: boolean; okText: string; badText: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-steel">{label}</span>
      <span className={`flex items-center gap-1.5 font-bold ${ok ? "text-success" : "text-warning-deep"}`}>
        <span className={`b-dot ${ok ? "bg-success" : "bg-warning"}`} />
        {ok ? okText : badText}
      </span>
    </div>
  );
}

/* ═══════════ داشبورد مدیر ═══════════ */
function ManagerDashboard({ data, why, setWhy }: { data: Dash; why: string | null; setWhy: (v: string | null) => void }) {
  const { t, lang } = useLang();
  const isRtl = lang.direction !== "ltr";
  const s = data.stats as Record<string, number>;
  const hs = (data.healthScore ?? {}) as Partial<{ academics: number | null; attendance: number | null; finance: number | null; communication: number | null; staffLoad: number | null; overall: number | null }>;
  const trend = (data.attendanceTrend as Array<{ date: string; present: number; total: number }>) ?? [];
  const gradeByClass = (data.gradeByClass as Array<{ name: string; avg: number | null }>) ?? [];
  const gradeByGrade = (data.gradeByGrade as Array<{ grade: string; avg: number }>) ?? [];
  const risk = (data.riskStudents as Array<{ name: string; class: string; early: number; late: number; drop: number }>) ?? [];
  const todayDetail = data.todayDetail as { absent: Array<{ name: string; class: string }>; late: Array<{ name: string; class: string }>; inSession: Array<{ className: string; subject: string; teacher: string }>; events: unknown[] } | undefined;
  const fee = data.feeSummary as { unpaid: number; paid: number; paidRatio: number; totalUnpaidAmount: number; monthRevenue: number };
  const wc = (data.whatChanged as Record<string, number | null>) ?? {};
  const bdays = (data.birthdays as Array<{ name: string; class: string; days: number }>) ?? [];
  const behavior = (data.behaviorFeed as Array<{ kind: string; reason: string; student: string; at: string }>) ?? [];
  const announcements = (data.announcements as Array<{ id: string; title: string; createdAt: string }>) ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* آمار کلیدی */}
      <StaggerGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard icon={GraduationCap} label={t("nav.students")} value={<CountUp value={s.students ?? 0} />} hint={`${faNumber(s.teachers ?? 0)} ${t("common.teacher")}`} /></StaggerItem>
        <StaggerItem>
          <StatCard icon={ClipboardCheck} label={t("dashboard.attendanceToday")} value={s.attendanceToday ? `${faNumber(Math.round(((s.attendanceToday - s.absentTodayCount) / s.attendanceToday) * 100))}٪` : "—"}
            tone={s.absentTodayCount > 0 ? "warning" : "spring"}
            hint={`${faNumber(s.absentTodayCount ?? 0)} ${t("dashboard.hint.absent")} · ${faNumber(s.lateTodayCount ?? 0)} ${t("dashboard.hint.late")}`} />
        </StaggerItem>
        <StaggerItem><StatCard icon={Wallet} label={t("dashboard.feeCollection")} value={`${faNumber(fee.paidRatio ?? 0)}٪`} tone={fee.paidRatio >= 80 ? "spring" : "warning"} hint={`${faNumber(fee.totalUnpaidAmount)} ${currencyLabel()} ${t("dashboard.hint.debt")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={SchoolIcon} label={t("dashboard.classesInSession")} value={<CountUp value={s.classesInSession ?? 0} />} tone="ink" hint={`${t("common.from")} ${faNumber(s.classes ?? 0)} ${t("common.class")}`} /></StaggerItem>
      </StaggerGroup>

      {/* What Changed + سلامت مدرسه */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="b-card-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.changesSinceYesterday")}</h3>
            <span className="b-badge b-badge-neutral">{t("dashboard.whatChanged")}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <DeltaCard label={t("dashboard.delta.attendance")} delta={wc.attendance} suffix="٪" />
            <DeltaCard label={t("dashboard.delta.unpaidFees")} delta={wc.unpaidFees} invert />
            <DeltaCard label={t("dashboard.delta.newRequests")} delta={wc.newRequests} invert />
            <DeltaCard label={t("dashboard.delta.riskStudents")} delta={wc.riskStudents} invert />
          </div>
          {todayDetail && todayDetail.absent.length > 0 && (
            <div className="mt-4 p-3 rounded-2xl bg-destructive/5 border border-destructive/15">
              <p className="text-[12px] font-bold text-destructive mb-1.5">{t("dashboard.todayAbsents")}:</p>
              <p className="text-[12px] text-steel leading-relaxed">{todayDetail.absent.slice(0, 8).map((a) => `${a.name} (${a.class})`).join("، ")}{todayDetail.absent.length > 8 ? " و…" : ""}</p>
            </div>
          )}
        </div>
        {/* سلامت مدرسه */}
        <div className="b-card-md p-5">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse className="w-4.5 h-4.5 w-5 h-5 text-spring" />
            <h3 className="font-bold">{t("dashboard.schoolHealth")}</h3>
          </div>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-20 h-20">
              <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--hairline-soft)" strokeWidth="8" />
                {typeof hs.overall === "number" && (
                  <circle cx="40" cy="40" r="34" fill="none" stroke={hs.overall >= 75 ? "var(--success)" : hs.overall >= 55 ? "var(--warning)" : "var(--blossom)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(hs.overall / 100) * 213.6} 213.6`} />
                )}
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg font-bold">{typeof hs.overall === "number" ? faNumber(hs.overall) : "—"}</span>
            </div>
            <div className="text-[12px] text-steel leading-relaxed">{t("dashboard.scoreOutOf100")}</div>
          </div>
          <div className="flex flex-col gap-2">
            <HealthRow label={t("dashboard.health.academics")} v={hs.academics} />
            <HealthRow label={t("dashboard.health.attendance")} v={hs.attendance} />
            <HealthRow label={t("dashboard.health.finance")} v={hs.finance} />
            <HealthRow label={t("dashboard.health.communication")} v={hs.communication} />
            <HealthRow label={t("dashboard.health.staffLoad")} v={hs.staffLoad} />
          </div>
        </div>
      </div>

      {/* چارت‌ها */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="b-card-md p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">{t("dashboard.attendanceTrend7d")}</h3>
            <WhyBtn id="attendance" open={why} setOpen={setWhy}
              content={`${faNumber(s.absentTodayCount ?? 0)} ${t("dashboard.why.absencesToday")} · ${faNumber(s.lateTodayCount ?? 0)} ${t("dashboard.why.lates")} · ${faNumber(s.teachersPresent ?? 0)} ${t("dashboard.why.teachersRecorded")}`} />
          </div>
          <LineChart data={trend.map((t) => ({ label: t.date, value: t.present, total: t.total }))} height={130} />
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.avgByGrade")}</h3>
          <BarChart data={gradeByGrade.map((g) => ({ label: g.grade, value: g.avg }))} max={20} />
        </div>
      </div>

      {/* ریسک + تولدها */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="b-card-md p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> {t("dashboard.atRiskDecline")}</h3>
            <Link href="/app/students" className="text-[12px] font-bold text-spring-deep hover:underline">{t("dashboard.allStudents")}</Link>
          </div>
          {risk.length === 0 ? <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noConcern")}</p> : (
            <div className="flex flex-col gap-2">
              {risk.map((r, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: isRtl ? 10 : -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-destructive/5">
                  <span className="b-badge b-badge-critical shrink-0">-{faNumber(r.drop)}</span>
                  <span className="flex-1 min-w-0 text-[12px] font-bold truncate">{r.name}</span>
                  <span className="text-[12px] text-steel shrink-0">{r.class}</span>
                  <span className="text-[12px] text-steel shrink-0">{faNumber(r.early)} ← {faNumber(r.late)}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2"><Cake className="w-4 h-4 text-blossom" /> {t("dashboard.birthdays")}</h3>
          {bdays.length === 0 ? <p className="t-sm text-steel py-4 text-center">{t("dashboard.empty.noBirthdayThisWeek")}</p> : (
            <div className="flex flex-col gap-2">
              {bdays.slice(0, 5).map((b, i) => (
                <div key={i} className="flex items-center justify-between text-[12px]">
                  <span className="font-bold truncate">{b.name}</span>
                  <span className="text-steel shrink-0">{b.days === 0 ? t("dashboard.birthday.today") : b.days > 0 ? `${faNumber(b.days)} ${t("dashboard.birthday.daysLater")}` : `${faNumber(-b.days)} ${t("dashboard.birthday.daysAgo")}`}</span>
                </div>
              ))}
            </div>
          )}
          {behavior.length > 0 && (
            <>
              <h3 className="font-bold mt-5 mb-3">{t("dashboard.recentBehavior")}</h3>
              <div className="flex flex-col gap-1.5">
                {behavior.slice(0, 4).map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-[12px]">
                    <span className={`b-dot shrink-0 ${b.kind === "POSITIVE" ? "bg-success" : "bg-destructive"}`} />
                    <span className="truncate">{b.student} — {b.reason}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DeltaCard({ label, delta, suffix, invert }: { label: string; delta: number | null | undefined; suffix?: string; invert?: boolean }) {
  const { t } = useLang();
  if (delta === null || delta === undefined) {
    return <div className="p-3 rounded-2xl bg-cloud"><p className="text-[12px] text-steel">{label}</p><p className="text-[14px] font-bold text-stone mt-1">—</p></div>;
  }
  if (delta === 0) {
    return <div className="p-3 rounded-2xl bg-cloud"><p className="text-[12px] text-steel">{label}</p><p className="text-[14px] font-bold text-steel mt-1">{t("dashboard.delta.noChange")}</p></div>;
  }
  const good = invert ? delta < 0 : delta > 0;
  return (
    <div className="p-3 rounded-2xl bg-cloud">
      <p className="text-[12px] text-steel">{label}</p>
      <p className={`text-[14px] font-bold mt-1 flex items-center gap-1 ${good ? "text-success" : "text-destructive"}`}>
        {delta > 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        {delta > 0 ? "+" : "−"}{faNumber(Math.abs(delta))}{suffix}
      </p>
    </div>
  );
}

function HealthRow({ label, v }: { label: string; v: number | null | undefined }) {
  const has = typeof v === "number";
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[12px] text-steel w-16 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-cloud overflow-hidden">
        {has ? (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${v}%` }}
            transition={{ duration: 0.8, ease: [0.05, 0.7, 0.1, 1] }}
            className={`h-full rounded-full ${v! >= 75 ? "bg-success" : v! >= 55 ? "bg-warning" : "bg-destructive"}`}
          />
        ) : null}
      </div>
      <span className="text-[12px] font-bold w-7 text-end">{has ? faNumber(v!) : "—"}</span>
    </div>
  );
}

function WhyBtn({ id, open, setOpen, content }: { id: string; open: string | null; setOpen: (v: string | null) => void; content: string }) {
  const { t } = useLang();
  return (
    <div className="relative">
      <button onClick={() => setOpen(open === id ? null : id)} className="b-btn b-btn-ghost !min-h-[40px] !text-[12px] !px-3 !py-1">
        {t("dashboard.why")} <ChevronDown className={`w-3 h-3 transition-transform ${open === id ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open === id && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            className="absolute top-full end-0 mt-2 z-20 b-card-sm p-3 text-[12px] text-steel leading-relaxed w-56 text-start b-shadow-rail"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ داشبورد معلم ═══════════ */
function TeacherDashboard({ data }: { data: Dash }) {
  const { t, lang } = useLang();
  const isRtl = lang.direction !== "ltr";
  const s = data.stats as Record<string, number>;
  const slots = (data.todaySlots as Array<{ id: string; period: number; class: { name: string }; subject: { name: string } }>) ?? [];
  const assignments = (data.assignments as Array<{ id: string; title: string; dueDate: string; class: { name: string }; subject: { name: string } | null }>) ?? [];
  const meetings = (data.pendingMeetings as Array<{ id: string; topic: string; requestedBy: { firstName: string; lastName: string } }>) ?? [];
  return (
    <div className="flex flex-col gap-8">
      {/* Quick Actions معلم */}
      <div className="b-card-tint p-5">
        <h3 className="font-bold mb-4">{t("dashboard.teacherQuickActions")}</h3>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { href: "/app/attendance", icon: ClipboardCheck, label: t("dashboard.qa.markAttendance") },
            { href: "/app/grades", icon: BarChart3, label: t("dashboard.qa.enterGrade") },
            { href: "/app/assignments", icon: NotebookPen, label: t("dashboard.qa.newAssignment") },
            { href: "/app/announcements", icon: BellPlus, label: t("dashboard.qa.sendNotice") },
            { href: "/app/behavior", icon: Sparkles, label: t("dashboard.qa.recordBehavior") },
            { href: "/app/question-bank", icon: FileCheck, label: t("nav.questionBank") },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-background hover:shadow-md transition-all hover:-translate-y-0.5">
              <span className="w-10 h-10 rounded-2xl bg-spring-tint text-spring-deep flex items-center justify-center"><a.icon className="w-5 h-5" /></span>
              <span className="text-center leading-snug text-[12px] font-bold">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <StaggerGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard icon={SchoolIcon} label={t("dashboard.myClasses")} value={<CountUp value={s.classes ?? 0} />} hint={`${faNumber(s.students ?? 0)} ${t("common.student")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={ClipboardCheck} label={t("dashboard.missingAttendanceToday")} value={<CountUp value={s.missingAttendance ?? 0} />} tone={s.missingAttendance ? "warning" : "spring"} /></StaggerItem>
        <StaggerItem><StatCard icon={MessageCircle} label={t("dashboard.parentMessages")} value={<CountUp value={s.parentUnread ?? 0} />} tone={s.parentUnread ? "blossom" : "spring"} /></StaggerItem>
        <StaggerItem><StatCard icon={Handshake} label={t("dashboard.meetingRequests")} value={<CountUp value={s.pendingMeetings ?? 0} />} tone={s.pendingMeetings ? "warning" : "spring"} /></StaggerItem>
      </StaggerGroup>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.myTodaySchedule")}</h3>
          {slots.length === 0 ? <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noPeriodTeacher")}</p> : (
            <div className="flex flex-col gap-2">
              {slots.map((sl, i) => (
                <motion.div key={sl.id} initial={{ opacity: 0, x: isRtl ? 8 : -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-3 rounded-2xl bg-cloud">
                  <span className="w-9 h-9 rounded-2xl bg-spring text-primary-foreground flex items-center justify-center text-[14px] font-bold shrink-0">{faNumber(sl.period)}</span>
                  <span className="flex-1 text-[14px] font-bold">{sl.subject?.name}</span>
                  <span className="text-[12px] text-steel">{sl.class?.name}</span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.upcomingAssignments")}</h3>
          {assignments.length === 0 ? <p className="t-sm text-steel py-6 text-center">{t("dashboard.empty.noAssignmentRecorded")}</p> : (
            <div className="flex flex-col gap-2">
              {assignments.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-cloud transition-colors">
                  <span className="b-dot bg-spring shrink-0" />
                  <span className="flex-1 text-[12px] font-bold truncate">{a.title}</span>
                  <span className="text-[12px] text-steel shrink-0">{a.class?.name}</span>
                  <span className="text-[12px] text-stone shrink-0">{formatDateFa(a.dueDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ داشبورد دانش‌آموز ═══════════ */
function StudentDashboard({ data }: { data: Dash }) {
  const { t } = useLang();
  const s = data.stats as Record<string, number>;
  const st = (data.subjectTrends as Array<{ subject: string; avg: number; delta: number }>) ?? [];
  const slots = (data.todaySlots as Array<{ id: string; period: number; subject: { name: string }; teacher: { firstName: string; lastName: string } | null }>) ?? [];
  const assignments = (data.assignments as Array<{ id: string; title: string; dueDate: string; subject: { name: string } | null }>) ?? [];
  const badges = (data.badges as Array<{ id: string; isFeatured: boolean; badge: { title: string; icon: string; tier: string } }>) ?? [];
  const featured = badges.find((b) => b.isFeatured)?.badge ?? badges[0]?.badge;
  return (
    <div className="flex flex-col gap-8">
      <StaggerGroup className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StaggerItem><StatCard icon={BarChart3} label={t("dashboard.gpa")} value={s.gpa ? faNumber(s.gpa) : "—"} hint={s.classRank ? `${t("dashboard.hint.rank")} ${faNumber(s.classRank)} ${t("common.from")} ${faNumber(s.classSize)}` : undefined} /></StaggerItem>
        <StaggerItem><StatCard icon={ClipboardCheck} label={t("dashboard.attendancePct")} value={s.attendanceRate ? `${faNumber(s.attendanceRate)}٪` : "—"} tone="spring" hint={`${faNumber(s.absences)} ${t("dashboard.mini.absence")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={Award} label={t("dashboard.badgePoints")} value={<CountUp value={s.badgePoints ?? 0} />} tone="blossom" hint={`${faNumber(badges.length)} ${t("dashboard.unit.badge")}`} /></StaggerItem>
        <StaggerItem><StatCard icon={Sparkles} label={t("dashboard.behaviorPoints")} value={<CountUp value={s.behaviorPoints ?? 0} />} tone={s.behaviorPoints >= 0 ? "spring" : "warning"} /></StaggerItem>
      </StaggerGroup>

      {featured && (
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="b-card-tint p-4 flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-spring/15 text-spring-deep flex items-center justify-center"><Award className="w-6 h-6" /></span>
          <div className="flex-1">
            <p className="text-[12px] font-bold">{t("dashboard.featuredBadge")} {featured.title}</p>
            <p className="text-[12px] text-steel">{t("dashboard.seeAllBadges")}</p>
          </div>
          <Link href="/app/badges" className="b-btn b-btn-sm b-btn-spring !min-h-[40px] !text-[12px]">{t("dashboard.myBadges")}</Link>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.subjectTrends")}</h3>
          {st.length === 0 ? <p className="t-sm text-steel">{t("dashboard.empty.noGradesYet")}</p> : (
            <div className="flex flex-col gap-2.5">
              {st.slice(0, 5).map((t) => (
                <div key={t.subject} className="flex items-center gap-2">
                  <span className="text-[12px] w-16 truncate">{t.subject}</span>
                  <div className="flex-1 h-2 rounded-full bg-cloud overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(t.avg / 20) * 100}%` }} transition={{ duration: 0.7 }} className="h-full bg-spring rounded-full" />
                  </div>
                  <span className="text-[12px] font-bold w-7">{faNumber(t.avg)}</span>
                  <span className={`text-[12px] font-bold w-9 text-end ${t.delta > 0 ? "text-success" : t.delta < 0 ? "text-destructive" : "text-stone"}`}>
                    {t.delta > 0 ? "↑" : t.delta < 0 ? "↓" : "—"}{Math.abs(t.delta) ? faNumber(Math.abs(t.delta)) : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.todaySchedule")}</h3>
          {slots.length === 0 ? <p className="t-sm text-steel py-4 text-center">{t("dashboard.empty.noPeriodStudent")}</p> : (
            <div className="flex flex-col gap-1.5">
              {slots.map((sl) => (
                <div key={sl.id} className="flex items-center gap-2.5 text-[12px] p-2 rounded-2xl hover:bg-cloud">
                  <span className="w-6 h-6 rounded-lg bg-spring-tint text-spring-deep flex items-center justify-center text-[12px] font-bold shrink-0">{faNumber(sl.period)}</span>
                  <span className="flex-1 font-bold truncate">{sl.subject?.name}</span>
                  <span className="text-[12px] text-steel shrink-0">{sl.teacher ? `${sl.teacher.firstName} ${sl.teacher.lastName}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.upcomingHomework")}</h3>
          {assignments.length === 0 ? <p className="t-sm text-steel py-4 text-center">{t("dashboard.empty.noHomework")}</p> : (
            <div className="flex flex-col gap-1.5">
              {assignments.slice(0, 5).map((a) => (
                <div key={a.id} className="flex items-center gap-2 text-[12px] p-2 rounded-2xl hover:bg-cloud">
                  <span className="b-dot bg-blossom shrink-0" />
                  <span className="flex-1 font-bold truncate">{a.title}</span>
                  <span className="text-[12px] text-stone shrink-0">{formatDateFa(a.dueDate)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════ داشبورد والد ═══════════ */
function ParentDashboard({ data }: { data: Dash }) {
  const { t } = useLang();
  const children = (data.children as Array<{ relation: string; studentId: string; student: { name: string; class: string; gpa: number | null; attendanceRate: number | null; absences: number; lates: number; unpaidFees: number; unpaidAmount: number; behaviorPoints: number; nextClass: string | null; homework: number } }>) ?? [];
  const meetings = (data.meetings as Array<{ id: string; topic: string; status: string; slotStart: string; staff: { firstName: string; lastName: string } }>) ?? [];
  const announcements = (data.announcements as Array<{ id: string; title: string; createdAt: string }>) ?? [];
  const s = data.stats as Record<string, number>;
  return (
    <div className="flex flex-col gap-8">
      {children.length === 0 && (
        <EmptyState icon={GraduationCap} title={t("dashboard.empty.noChildLinked")} desc={t("dashboard.empty.contactManagerToLink")} />
      )}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3">
        {children.map((ch, i) => (
          <motion.div key={ch.studentId} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="b-card-md p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-[16px]">{ch.student.name}</p>
                <p className="text-[12px] text-steel">{ch.student.class} · {ch.relation === "FATHER" ? t("dashboard.relation.father") : ch.relation === "MOTHER" ? t("dashboard.relation.mother") : t("dashboard.relation.guardian")}</p>
              </div>
              <Link href={`/app/students/${ch.studentId}`} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px]">{t("dashboard.childFile")}</Link>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <MiniStat label={t("dashboard.gpa")} value={ch.student.gpa ? faNumber(ch.student.gpa) : "—"} />
              <MiniStat label={t("dashboard.mini.attendance")} value={ch.student.attendanceRate ? `${faNumber(ch.student.attendanceRate)}٪` : "—"} good={(ch.student.attendanceRate ?? 0) >= 90} />
              <MiniStat label={t("dashboard.mini.absence")} value={faNumber(ch.student.absences)} good={ch.student.absences < 3} />
              <MiniStat label={t("dashboard.mini.late")} value={faNumber(ch.student.lates)} good={ch.student.lates < 3} />
              <MiniStat label={t("dashboard.mini.homework")} value={faNumber(ch.student.homework)} />
              <MiniStat label={t("dashboard.mini.behavior")} value={faNumber(ch.student.behaviorPoints)} good={ch.student.behaviorPoints >= 0} />
            </div>
            {ch.student.nextClass && (
              <p className="mt-3 text-[12px] text-steel"><CheckCircle2 className="w-3.5 h-3.5 inline text-spring" /> {t("dashboard.nextPeriod")} {ch.student.nextClass}</p>
            )}
            {ch.student.unpaidFees > 0 && (
              <p className="mt-2 text-[12px] text-destructive font-bold"><AlertTriangle className="w-3.5 h-3.5 inline" /> {faNumber(ch.student.unpaidFees)} {t("dashboard.unpaidInstallments")} ({faNumber(ch.student.unpaidAmount)} {currencyLabel()})</p>
            )}
          </motion.div>
        ))}
      </div>
      {announcements.length > 0 && (
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.schoolNotices")}</h3>
          <div className="flex flex-col gap-2">
            {announcements.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-cloud text-[12px]">
                <span className="flex-1 font-bold truncate">{a.title}</span>
                <span className="text-[12px] text-stone shrink-0">{formatDateFa(a.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {meetings.length > 0 && (
        <div className="b-card-md p-5">
          <h3 className="font-bold mb-4">{t("dashboard.pendingMeetings")}</h3>
          <div className="flex flex-col gap-2">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-2xl bg-cloud text-[12px]">
                <span className={`b-badge ${m.status === "APPROVED" ? "b-badge-success" : "b-badge-warning"}`}>{m.status === "APPROVED" ? t("dashboard.meeting.approved") : t("dashboard.meeting.pending")}</span>
                <span className="flex-1 font-bold truncate">{m.topic}</span>
                <span className="text-[12px] text-steel">{m.staff.firstName} {m.staff.lastName}</span>
                <span className="text-[12px] text-stone">{formatDateFa(m.slotStart)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="p-2.5 rounded-2xl bg-cloud text-center">
      <p className="text-[12px] text-steel">{label}</p>
      <p className={`text-[14px] font-bold ${good === false ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
