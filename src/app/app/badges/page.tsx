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

type BadgeT = { id: string; key: string; title: string; description: string; icon: string; tier: string; points: number; effectKind: string; schoolId: string | null };
type Earned = { id: string; isFeatured: boolean; awardedAt: string; badge: BadgeT };
type StudentOpt = { id: string; user: { firstName: string; lastName: string } };

/* رنگ‌های فلزی تیر (برنز/نقره/طلا/الماس) — تزئینی و داده‌محور؛
   متن هر تیر در دارک روشن‌تر می‌شود تا روی کارت تیره خوانا بماند */
const TIER_STYLE: Record<string, { label: string; cls: string; icon: typeof Medal }> = {
  BRONZE: { label: "برنز", cls: "from-[#e8b94a]/30 to-[#c98f3a]/10 text-[#8A6116] dark:text-[#e8c077]", icon: Medal },
  SILVER: { label: "نقره", cls: "from-[#d8dee4]/40 to-[#aeb9c2]/10 text-[#5d6f66] dark:text-[#bcc8cf]", icon: Medal },
  GOLD: { label: "طلا", cls: "from-[#f7d774]/40 to-[#e8b94a]/10 text-[#8A6116] dark:text-[#f2d488]", icon: Crown },
  DIAMOND: { label: "الماس", cls: "from-[#a8e6f0]/40 to-[#67c6d8]/10 text-[#0e6a7a] dark:text-[#8ed8e8]", icon: Crown },
};

const TIER_OPTIONS = [
  { value: "BRONZE", label: "برنز" },
  { value: "SILVER", label: "نقره" },
  { value: "GOLD", label: "طلا" },
  { value: "DIAMOND", label: "الماس" },
];

const EFFECT_OPTIONS = [
  { value: "NONE", label: "بدون افکت" },
  { value: "FRAME", label: "قاب پروفایل" },
  { value: "ANIMATION", label: "انیمیشن افتخارات" },
];

export default function BadgesPage() {
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
      .catch((e) => { toast.error(e instanceof Error ? e.message : "خطا در بارگذاری بج‌ها"); })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    apiGet<{ students: StudentOpt[] }>("/api/students").then((d) => { setStudents(d.students ?? []); setIsStaff(true); }).catch(() => setIsStaff(false));
  }, []);

  async function give() {
    if (!award.badgeId || !award.studentId) { toast.error("بج و دانش‌آموز را انتخاب کنید"); return; }
    try {
      await apiPost("/api/badges", { action: "award", ...award });
      toast.success("بج اهدا شد.");
      setAward({ badgeId: "", studentId: "" }); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  async function defineBadge() {
    if (!draft.title.trim()) { toast.error("عنوان بج را بنویسید."); return; }
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
      toast.success(inSchoolPanel ? "بج مدرسه تعریف شد." : "بج سراسری تعریف شد.");
      setDraft({ key: "", title: "", description: "", tier: "BRONZE", points: "10", effectKind: "NONE", icon: "Award" });
      setShowDefine(false);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setDefining(false); }
  }

  /** انتخاب بج ویژه — دانش‌آموز روی بج‌های خودش، کارکنان روی بج‌های دانش‌آموز نمایش‌داده‌شده */
  async function feature(badgeId: string) {
    if (!myStudentId) { toast.error("ابتدا بج دریافت کنید."); return; }
    try {
      await apiPost("/api/badges", { action: "feature", badgeId, studentId: myStudentId });
      toast.success("نشان ویژه انتخاب شد.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  const earnedIds = new Set(earned.map((e) => e.badge.id));
  const globalBadges = badges.filter((b) => b.schoolId === null);
  const schoolBadges = badges.filter((b) => b.schoolId !== null);
  return (
    <div>
      <PageHeader title="بج‌ها و افتخارات" desc="مجموعه نشان‌های مدرسه — مثل بازی‌های موبایلی، جمعشون کن و نشان بده!" />

      {/* ═══ تعریف بج جدید — فقط سوپرادمین (FIX راند ۱۸) ═══ */}
      {isSuperAdmin && (
        <div className="mb-6">
          {!showDefine ? (
            <button className="b-btn b-btn-spring" onClick={() => setShowDefine(true)}>
              <Plus className="w-4 h-4" /> تعریف بج جدید
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="b-card-tint p-4 md:p-5">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4 text-spring-deep shrink-0" />
                <b className="text-[13.5px]">تعریف بج جدید</b>
                <span className="b-badge b-badge-neutral !text-[10px]">
                  {inSchoolPanel ? (
                    <>بج مدرسه «{user.schoolName}»</>
                  ) : (
                    <>بج سراسری — همه مدارس</>
                  )}
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">عنوان بج *</span>
                  <input
                    className="b-input"
                    placeholder="مثلاً ستاره دانش"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">کلید لاتین (اختیاری — خودکار ساخته می‌شود)</span>
                  <input
                    className="b-input"
                    dir="ltr"
                    placeholder="star-of-knowledge"
                    value={draft.key}
                    onChange={(e) => setDraft({ ...draft, key: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">تیر (درجه)</span>
                  <Select
                    value={draft.tier}
                    onChange={(v) => setDraft({ ...draft, tier: v })}
                    options={TIER_OPTIONS}
                    buttonClassName="!w-full"
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">امتیاز (۱ تا ۱۰۰۰)</span>
                  <input
                    className="b-input"
                    dir="ltr"
                    inputMode="numeric"
                    value={draft.points}
                    onChange={(e) => setDraft({ ...draft, points: e.target.value.replace(/[^0-9]/g, "") })}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">افکت ویژه</span>
                  <Select
                    value={draft.effectKind}
                    onChange={(v) => setDraft({ ...draft, effectKind: v })}
                    options={EFFECT_OPTIONS}
                    buttonClassName="!w-full"
                    className="w-full"
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
                  <span className="text-[12px] font-bold">توضیح (شرط گرفتن بج)</span>
                  <input
                    className="b-input"
                    placeholder="مثلاً معدل بالای ۱۹ در دو ترم پیاپی"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              </div>
              <div className="flex items-center gap-2 mt-4">
                <button className="b-btn b-btn-spring" onClick={defineBadge} disabled={defining}>
                  <Award className="w-4 h-4" /> {defining ? "در حال ذخیره…" : "تعریف بج"}
                </button>
                <button className="b-btn b-btn-ghost !text-steel" onClick={() => setShowDefine(false)} disabled={defining}>
                  انصراف
                </button>
                {!inSchoolPanel && (
                  <span className="text-[11px] text-steel leading-relaxed">
                    برای بجِ مخصوص یک مدرسه، از صفحه «مدارس» وارد پنل آن مدرسه شوید و اینجا بج بسازید.
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
            placeholder="انتخاب بج…"
            searchable
            options={badges.map((b) => ({ value: b.id, label: b.title, hint: `${faNumber(b.points)} امتیاز` }))}
            buttonClassName="!h-10 !w-48"
            className="!w-48"
            ariaLabel="انتخاب بج برای اهدا"
          />
          <Select
            value={award.studentId}
            onChange={(v) => setAward({ ...award, studentId: v })}
            placeholder="به دانش‌آموز…"
            searchable
            options={students.map((s) => ({ value: s.id, label: `${s.user.firstName} ${s.user.lastName}` }))}
            buttonClassName="!h-10 !w-48"
            className="!w-48"
            ariaLabel="انتخاب دانش‌آموز برای اهدا بج"
          />
          <button onClick={give} className="b-btn b-btn-sm b-btn-spring">اهدا</button>
        </div>
      )}

      {earned.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Star className="w-4 h-4 text-blossom" /> بج‌های من ({faNumber(earned.length)}) — {faNumber(earned.reduce((s, e) => s + e.badge.points, 0))} امتیاز</h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {earned.map((e, i) => {
              const t = TIER_STYLE[e.badge.tier] ?? TIER_STYLE.BRONZE;
              return (
                <motion.div key={e.id} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.06, type: "spring", stiffness: 500, damping: 28 }}
                  className={`b-card-sm p-4 text-center bg-gradient-to-b ${t.cls}`}>
                  <Award className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[12.5px] font-bold">{e.badge.title}</p>
                  <p className="text-[10px] opacity-70">{faNumber(e.badge.points)} امتیاز · {formatDateFa(e.awardedAt)}</p>
                  {e.isFeatured ? (
                    <span className="b-badge b-badge-blossom mt-1.5"><Star className="w-3 h-3 inline ml-1" />نشان ویژه من</span>
                  ) : (
                    <button onClick={() => feature(e.badge.id)} className="b-btn b-btn-sm b-btn-ghost !min-h-[24px] !text-[10px] !px-2 !py-0 mt-1.5">
                      <Star className="w-3 h-3" /> انتخاب به‌عنوان نشان ویژه
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
            <Globe2 className="w-4 h-4 text-spring" /> بج‌های سراسری سامانه ({faNumber(globalBadges.length)})
          </h2>
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {globalBadges.map((b, i) => (
              <BadgeCard key={b.id} b={b} i={i} has={earnedIds.has(b.id)} onDelete={isSuperAdmin ? async () => { if (!window.confirm(`بج «${b.title}» حذف شود؟`)) return; try { await apiDelete(`/api/badges?id=${b.id}`); toast.success("بج حذف شد."); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } } : undefined} />
            ))}
          </div>
        </div>
      )}

      {/* بج‌های همین مدرسه */}
      {schoolBadges.length > 0 && (
        <div className="mb-8">
          <h2 className="font-bold mb-3">بج‌های مدرسه ({faNumber(schoolBadges.length)})</h2>
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
          title="بجی تعریف نشده"
          desc={
            isSuperAdmin
              ? "با دکمه «تعریف بج جدید» اولین بج را بسازید — به‌صورت سراسری یا مخصوص مدرسه‌ای که پنلش را باز کرده‌اید."
              : "بج‌ها را مدیر کل سامانه تعریف می‌کند؛ به‌محض تعریف، اینجا برای اهدا به دانش‌آموزان نمایش داده می‌شود."
          }
          action={
            isSuperAdmin && !showDefine ? (
              <button className="b-btn b-btn-sm b-btn-spring" onClick={() => setShowDefine(true)}>
                <Plus className="w-4 h-4" /> تعریف اولین بج
              </button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

function BadgeCard({ b, i, has, onDelete }: { b: BadgeT; i: number; has: boolean; onDelete?: () => void }) {
  const t = TIER_STYLE[b.tier] ?? TIER_STYLE.BRONZE;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i * 0.03, 0.5) }}
      className={`b-card-sm p-4 text-center relative ${has ? "" : "opacity-45 grayscale"}`}
    >
      <t.icon className="w-7 h-7 mx-auto mb-2" />
      <p className="text-[12px] font-bold">{b.title}</p>
      <p className="text-[10px] text-steel line-clamp-2 mt-0.5">{b.description}</p>
      <span className="b-badge b-badge-neutral mt-2">{t.label} · {faNumber(b.points)}</span>
      {!has && <Lock className="absolute top-2 left-2 w-3.5 h-3.5 text-stone" />}
      {onDelete && (
        <button onClick={onDelete} aria-label="حذف بج" className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-stone hover:text-destructive hover:bg-cloud">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}
