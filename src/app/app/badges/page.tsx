"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Star, Crown, Medal, Lock, Plus, Sparkles, Globe2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { useShellUser } from "@/components/app-shell/app-shell";
import { useLang } from "@/lib/i18n";

type BadgeT = { id: string; key: string; title: string; description: string; icon: string; tier: string; points: number; effectKind: string; schoolId: string | null };
type Earned = { id: string; isFeatured: boolean; awardedAt: string; badge: BadgeT };
type StudentOpt = { id: string; user: { firstName: string; lastName: string } };

/* رنگ‌های فلزی تیر (برنز/نقره/طلا/الماس) — تزئینی و داده‌محور؛
   متن هر تیر در دارک روشن‌تر می‌شود تا روی کارت تیره خوانا بماند */
const TIER_STYLE: Record<string, { cls: string; icon: typeof Medal }> = {
  BRONZE: { cls: "from-[#f2a918]/30 to-[#f2a918]/10 text-[#8a4c0b] dark:text-[#f2a918]", icon: Medal },
  SILVER: { cls: "from-[#cdd5d1]/40 to-[#cdd5d1]/10 text-[#5d6f66] dark:text-[#cdd5d1]", icon: Medal },
  GOLD: { cls: "from-[#f2a918]/40 to-[#f2a918]/10 text-[#8a4c0b] dark:text-[#f2a918]", icon: Crown },
  DIAMOND: { cls: "from-[#1972c4]/40 to-[#1972c4]/10 text-[#006749] dark:text-[#1972c4]", icon: Crown },
};

const TIER_TKEY: Record<string, string> = {
  BRONZE: "badges.tier.bronze",
  SILVER: "badges.tier.silver",
  GOLD: "badges.tier.gold",
  DIAMOND: "badges.tier.diamond",
};

const TIER_OPTIONS = [
  { value: "BRONZE", tkey: "badges.tier.bronze" },
  { value: "SILVER", tkey: "badges.tier.silver" },
  { value: "GOLD", tkey: "badges.tier.gold" },
  { value: "DIAMOND", tkey: "badges.tier.diamond" },
];

const EFFECT_OPTIONS = [
  { value: "NONE", tkey: "badges.effect.none" },
  { value: "FRAME", tkey: "badges.effect.frame" },
  { value: "ANIMATION", tkey: "badges.effect.animation" },
];

export default function BadgesPage() {
  const { t } = useLang();
  const { user } = useShellUser();
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const inSchoolPanel = !!user.actingSchoolId;

  const [badges, setBadges] = useState<BadgeT[]>([]);
  const [earned, setEarned] = useState<Earned[]>([]);
  const [students, setStudents] = useState<StudentOpt[]>([]);
  const [myStudentId, setMyStudentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [award, setAward] = useState({ badgeId: "", studentId: "" });

  // فرم تعریف بج — فقط سوپرادمین (FIX راند ۱۸)
  const [showDefine, setShowDefine] = useState(false);
  const [defining, setDefining] = useState(false);
  const [draft, setDraft] = useState({ key: "", title: "", description: "", tier: "BRONZE", points: "10", effectKind: "NONE", icon: "Award" });

  const load = useCallback(() => {
    apiGet<{ badges: BadgeT[]; earned: Earned[]; totalPoints: number; studentId: string | null }>("/api/badges")
      .then((d) => { setBadges(d.badges); setEarned(d.earned); setMyStudentId(d.studentId ?? null); })
      .catch((e) => { toast.error(e instanceof Error ? e.message : t("badges.error.load")); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    apiGet<{ students: StudentOpt[] }>("/api/students").then((d) => { setStudents(d.students ?? []); setIsStaff(true); }).catch(() => setIsStaff(false));
  }, []);

  async function give() {
    if (!award.badgeId || !award.studentId) { toast.error(t("badges.toast.selectBadgeStudent")); return; }
    try {
      await apiPost("/api/badges", { action: "award", ...award });
      toast.success(t("badges.toast.awarded"));
      setAward({ badgeId: "", studentId: "" }); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  async function defineBadge() {
    if (!draft.title.trim()) { toast.error(t("badges.toast.titleRequired")); return; }
    setDefining(true);
    try {
      await apiPost("/api/badges", {
        action: "define",
        badge: {
          key: draft.key || draft.title,
          title: draft.title.trim(),
          description: draft.description.trim(),
          icon: draft.icon,
          tier: draft.tier,
          points: Math.max(1, Math.min(1000, Number(draft.points) || 10)),
          effectKind: draft.effectKind,
        },
      });
      toast.success(inSchoolPanel ? t("badges.toast.schoolDefined") : t("badges.toast.globalDefined"));
      setDraft({ key: "", title: "", description: "", tier: "BRONZE", points: "10", effectKind: "NONE", icon: "Award" });
      setShowDefine(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
    finally { setDefining(false); }
  }

  /** انتخاب بج ویژه — دانش‌آموز روی بج‌های خودش، کارکنان روی بج‌های دانش‌آموز نمایش‌داده‌شده */
  async function feature(badgeId: string) {
    if (!myStudentId) { toast.error(t("badges.toast.receiveFirst")); return; }
    try {
      await apiPost("/api/badges", { action: "feature", badgeId, studentId: myStudentId });
      toast.success(t("badges.toast.featured"));
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); }
  }

  if (loading) return <LoadingBlock />;
  const earnedIds = new Set(earned.map((e) => e.badge.id));
  const globalBadges = badges.filter((b) => b.schoolId === null);
  const schoolBadges = badges.filter((b) => b.schoolId !== null);
  return (
    <div>
      <PageHeader title={t("nav.badges")} desc={t("badges.desc")} />

      {/* ═══ تعریف بج جدید — فقط سوپرادمین (FIX راند ۱۸) ═══ */}
      {isSuperAdmin && (
        <div className="mb-6">
          {!showDefine ? (
            <button className="b-btn b-btn-spring" onClick={() => setShowDefine(true)}>
              <Plus className="w-4 h-4" /> {t("badges.defineNew")}
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="b-card-tint p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-spring-deep shrink-0" />
                <b className="text-[14px]">{t("badges.defineNew")}</b>
                <span className="b-badge b-badge-neutral !text-[12px]">
                  {inSchoolPanel ? (
                    <>{t("badges.schoolBadge")} «{user.schoolName}»</>
                  ) : (
                    <>{t("badges.globalNote")}</>
                  )}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("badges.field.title")}</span>
                  <input
                    className="b-input"
                    placeholder={t("badges.placeholder.title")}
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("badges.field.key")}</span>
                  <input
                    className="b-input"
                    dir="ltr"
                    placeholder="star-of-knowledge"
                    value={draft.key}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("badges.field.tier")}</span>
                  <Select
                    value={draft.tier}
                    onChange={(v) => setDraft({ ...draft, tier: v })}
                    options={TIER_OPTIONS.map((o) => ({ value: o.value, label: t(o.tkey) }))}
                    buttonClassName="!w-full"
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("badges.field.points")}</span>
                  <input
                    className="b-input"
                    dir="ltr"
                    inputMode="numeric"
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: e.target.value.replace(/[^0-9]/g, "") })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{t("badges.field.effect")}</span>
                  <Select
                    value={draft.effectKind}
                    onChange={(v) => setDraft({ ...draft, effectKind: v })}
                    options={EFFECT_OPTIONS.map((o) => ({ value: o.value, label: t(o.tkey) }))}
                    buttonClassName="!w-full"
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                  <span className="text-[12px] font-bold">{t("badges.field.description")}</span>
                  <input
                    className="b-input"
                    placeholder={t("badges.placeholder.description")}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button className="b-btn b-btn-spring" onClick={defineBadge} disabled={defining}>
                  <Award className="w-4 h-4" /> {defining ? t("common.saving") : t("badges.define")}
                </button>
                <button className="b-btn b-btn-ghost !text-steel" onClick={() => setShowDefine(false)} disabled={defining}>
                  {t("common.cancel")}
                </button>
                {!inSchoolPanel && (
                  <span className="text-[12px] text-steel leading-relaxed">
                    {t("badges.schoolHint")}
                  </span>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {isStaff && badges.length > 0 && students.length > 0 && (
        <div className="b-card-tint p-4 mb-6 flex flex-wrap gap-2 items-center">
          <Award className="w-4 h-4 text-spring-deep shrink-0" />
          <Select
            value={award.badgeId}
            onChange={(v) => setAward({ ...award, badgeId: v })}
            placeholder={t("badges.select.badge")}
            searchable
            options={badges.map((b) => ({ value: b.id, label: b.title, hint: `${faNumber(b.points)} ${t("badges.points")}` }))}
            buttonClassName="!h-10 !w-48"
            className="!w-48"
            ariaLabel={t("badges.select.badgeForAward")}
          />
          <Select
            value={award.studentId}
            onChange={(v) => setAward({ ...award, studentId: v })}
            placeholder={t("badges.select.student")}
            searchable
            options={students.map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}` }))}
            buttonClassName="!h-10 !w-48"
            className="!w-48"
            ariaLabel={t("badges.select.studentForAward")}
          />
          <button onClick={give} className="b-btn b-btn-sm b-btn-spring">{t("badges.award")}</button>
        </div>
      )}

      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-blossom" /> {t("badges.myBadges")} ({faNumber(earned.length)}) — {faNumber(earned.reduce((s, e) => s + e.badge.points, 0))} {t("badges.points")}</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map((e, i) => {
              const tier = TIER_STYLE[e.badge.tier] ?? TIER_STYLE.BRONZE;
              return (
                <motion.div key={e.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 500, damping: 28 }}
                  className={`b-card-sm p-4 text-center bg-gradient-to-b ${tier.cls}`}>
                  <Award className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[12px] font-bold">{e.badge.title}</p>
                  <p className="text-[12px] opacity-70">{faNumber(e.badge.points)} {t("badges.points")} · {formatDateFa(e.awardedAt)}</p>
                  {e.isFeatured ? (
                    <span className="b-badge b-badge-blossom mt-1.5"><Star className="w-3 h-3 inline ms-1" />{t("badges.myFeatured")}</span>
                  ) : (
                    <button onClick={() => feature(e.badge.id)} className="b-btn b-btn-sm b-btn-ghost !min-h-[40px] !text-[12px] !px-2 !py-0 mt-1.5">
                      <Star className="w-3 h-3" /> {t("badges.setFeatured")}
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* بج‌های سراسری سامانه */}
      {globalBadges.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-spring" /> {t("badges.globalTitle")} ({faNumber(globalBadges.length)})
          </h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {globalBadges.map((b, i) => (
              <BadgeCard key={b.id} b={b} i={i} has={earnedIds.has(b.id)} onDelete={isSuperAdmin ? async () => { if (!window.confirm(`${t("badges.deleteConfirm.badge")} «${b.title}» ${t("badges.deleteConfirm.suffix")}`)) return; try { await apiDelete(`/api/badges?id=${b.id}`); toast.success(t("badges.toast.deleted")); load(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } } : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* بج‌های همین مدرسه */}
      {schoolBadges.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold mb-3">{t("badges.schoolTitle")} ({faNumber(schoolBadges.length)})</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {schoolBadges.map((b, i) => (
              <BadgeCard key={b.id} b={b} i={i} has={earnedIds.has(b.id)} />
            ))}
          </div>
        </div>
      )}

      {badges.length === 0 && (
        <EmptyState
          icon={Award}
          title={t("badges.empty.title")}
          desc={
            isSuperAdmin
              ? t("badges.empty.manageDesc")
              : t("badges.empty.userDesc")
          }
          action={
            isSuperAdmin && !showDefine ? (
              <button className="b-btn b-btn-sm b-btn-spring" onClick={() => setShowDefine(true)}>
                <Plus className="w-4 h-4" /> {t("badges.defineFirst")}
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function BadgeCard({ b, i, has, onDelete }: { b: BadgeT; i: number; has: boolean; onDelete?: () => void }) {
  const { t } = useLang();
  const tier = TIER_STYLE[b.tier] ?? TIER_STYLE.BRONZE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.5) }}
      className={`b-card-sm p-4 text-center relative ${has ? "" : "opacity-45 grayscale"}`}
    >
      <tier.icon className="w-7 h-7 mx-auto mb-2" />
      <p className="text-[12px] font-bold">{b.title}</p>
      <p className="text-[12px] text-steel line-clamp-2 mt-0.5">{b.description}</p>
      <span className="b-badge b-badge-neutral mt-2">{t(TIER_TKEY[b.tier] ?? "badges.tier.bronze")} · {faNumber(b.points)}</span>
      {!has && <Lock className="absolute top-2 start-2 w-3.5 h-3.5 text-stone" />}
      {onDelete && (
        <button onClick={onDelete} aria-label={t("badges.deleteBadge")} className="absolute top-2 end-2 w-6 h-6 rounded-full flex items-center justify-center text-stone hover:text-destructive hover:bg-cloud">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}
