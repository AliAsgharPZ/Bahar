"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  KeyRound, Loader2, IdCard, UserRound, Phone, MapPin, GraduationCap, ShieldCheck,
  Pencil, Send, Clock, CheckCircle2, XCircle, Info, LogOut,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useApi, apiPost, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, RoleBadge , ErrorBox } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Select } from "@/components/shared/pickers";
import { ProfileImageCard } from "@/components/profile/profile-image-card";
import { TwoFactorCard } from "@/components/settings/twofactor-card";
import { formatDateFa, PARENT_RELATION_LABELS, GENDER_LABELS, relativeTimeFa, enDigits } from "@/lib/persian";
import type { AvatarParams } from "@/lib/avatar";

type Me = {
  user: {
    id: string; nationalId: string; role: string; firstName: string; lastName: string;
    fatherName: string | null; gender: string | null; birthDate: string | null; birthPlace: string | null;
    phone: string | null; homePhone: string | null; shadNumber: string | null; email: string | null;
    address: string | null; postalCode: string | null; education: string | null; fieldOfStudy: string | null;
    jobTitle: string | null; staffCode: string | null; mustChangePassword: boolean; lastLoginAt: string | null;
    profileImageType: "upload" | "avatar" | null;
    photoUrl: string | null;
    avatar: AvatarParams | null;
    school: { name: string; code: string } | null;
    hasPendingChanges?: boolean;
    studentProfile: {
      studentNumber: string; entryYear: string | null; previousSchool: string | null; healthNotes: string | null;
      class: { name: string } | null;
      parents: Array<{ relation: string; parentUser: { id: string; firstName: string; lastName: string; nationalId: string; phone: string | null; shadNumber: string | null; jobTitle: string | null; education: string | null } }>;
    } | null;
  };
};

type ChangeRequest = {
  id: string;
  changes: Record<string, { from: string | null; to: string }>;
  reason: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "نام", lastName: "نام خانوادگی", fatherName: "نام پدر", gender: "جنسیت",
  birthPlace: "محل تولد", birthDate: "تاریخ تولد", phone: "موبایل", homePhone: "تلفن خانه",
  email: "ایمیل", address: "آدرس", postalCode: "کد پستی", shadNumber: "شماره شاد",
  education: "مدرک تحصیلی", fieldOfStudy: "رشته تحصیلی", jobTitle: "شغل",
};

const EDITABLE_FIELDS: { key: string; label: string; ltr?: boolean; select?: boolean }[] = [
  { key: "firstName", label: "نام" },
  { key: "lastName", label: "نام خانوادگی" },
  { key: "fatherName", label: "نام پدر" },
  { key: "gender", label: "جنسیت", select: true },
  { key: "birthPlace", label: "محل تولد" },
  { key: "phone", label: "موبایل", ltr: true },
  { key: "homePhone", label: "تلفن خانه", ltr: true },
  { key: "email", label: "ایمیل", ltr: true },
  { key: "address", label: "آدرس" },
  { key: "postalCode", label: "کد پستی", ltr: true },
  { key: "shadNumber", label: "شماره شاد", ltr: true },
  { key: "education", label: "مدرک تحصیلی" },
  { key: "fieldOfStudy", label: "رشته تحصیلی" },
  { key: "jobTitle", label: "شغل" },
] as { key: string; label: string; ltr?: boolean; select?: boolean }[];

export default function ProfilePage() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, loading, error: meError, refetch: refetchMe } = useApi<Me>("/api/auth/me");
  const { data: reqData, refetch: refetchReqs } = useApi<{ requests: ChangeRequest[] }>("/api/profile-requests");
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  // خروج از حساب — در موبایل (بدون سایدبار) تنها مسیر خروج همین صفحه است
  const [loggingOut, setLoggingOut] = useState(false);
  async function doLogout() {
    setLoggingOut(true);
    try {
      await apiPost("/api/auth/logout").catch(() => {});
      toast.success("خارج شدید؛ به امید دیدار!");
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const u = data?.user;
  const isService = u?.role === "SUPER_ADMIN" || u?.role === "ADMIN";

  useEffect(() => {
    if (params.get("change") === "1") {
      document.getElementById("change-pw")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [params]);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("تکرار رمز با رمز جدید یکسان نیست.");
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/auth/change-password", { currentPassword: cur, newPassword: next });
      toast.success("رمز عبور تغییر کرد!");
      setCur(""); setNext(""); setConfirm("");
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  function openEdit() {
    if (!u) return;
    setEditForm({
      firstName: u.firstName, lastName: u.lastName, fatherName: u.fatherName ?? "",
      gender: u.gender ?? "", birthPlace: u.birthPlace ?? "", phone: u.phone ?? "",
      homePhone: u.homePhone ?? "", email: u.email ?? "", address: u.address ?? "",
      postalCode: u.postalCode ?? "", shadNumber: u.shadNumber ?? "",
      education: u.education ?? "", fieldOfStudy: u.fieldOfStudy ?? "", jobTitle: u.jobTitle ?? "",
    });
    setReason("");
    setEditing(true);
  }

  async function submitChanges(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (isService) {
        // نقش‌های سرویس approver ندارند — ویرایش مستقیمِ فیلدهای پایه
        await apiPatch("/api/auth/me", {
          firstName: editForm.firstName,
          lastName: editForm.lastName,
          phone: enDigits(editForm.phone ?? ""),
          email: editForm.email ?? "",
        });
        toast.success("مشخصات شما ذخیره شد.");
        setEditing(false);
        refetchMe();
      } else {
        const changes: Record<string, string> = {};
        for (const f of EDITABLE_FIELDS) {
          const raw = editForm[f.key] ?? "";
          const val = f.ltr ? enDigits(raw) : raw;
          changes[f.key] = val.trim();
        }
        const res = await apiPost<{ approver: string }>("/api/profile-requests", { changes, reason: reason || undefined });
        toast.success(`درخواست ثبت شد و به ${res.approver} ارسال شد.`);
        setEditing(false);
        refetchReqs();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingBlock />;
  if (meError || !data) return <ErrorBox message={meError ?? "خطا در بارگذاری پروفایل"} />;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="پروفایل من"
        desc={u?.school ? `متصل به ${u.school.name}` : "سرویس بهار"}
        action={
          u ? (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={openEdit}>
              <Pencil className="w-4 h-4" /> ویرایش مشخصات من
            </button>
          ) : undefined
        }
      />

      {u && (
        <>
          {/* تصویر پروفایل — آپلود عکس یا ساخت آواتار */}
          <ProfileImageCard me={{ id: u.id, firstName: u.firstName, lastName: u.lastName }} onChanged={refetchMe} />

          <div className="b-card-md p-6 md:p-8">
            <div className="flex items-center gap-4 flex-wrap">
              <UserAvatar
                user={{
                  id: u.id, firstName: u.firstName, lastName: u.lastName,
                  profileImageType: u.profileImageType, photoUrl: u.photoUrl, avatar: u.avatar,
                }}
                size={64}
                className="ring-4 ring-spring-tint"
              />
              <div className="flex flex-col gap-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <b className="text-lg">{u.firstName} {u.lastName}</b>
                  <RoleBadge role={u.role} />
                  {u.mustChangePassword && <span className="b-badge b-badge-warning">رمز اولیه — تغییر دهید</span>}
                </div>
                <span className="t-sm text-steel" dir="ltr">
                  نام کاربری (کد ملی): <b className="font-mono">{u.nationalId}</b>
                </span>
                {u.lastLoginAt && <span className="text-[11.5px] text-stone">آخرین ورود: {formatDateFa(u.lastLoginAt)}</span>}
              </div>
            </div>
          </div>

          {/* فرم درخواست ویرایش */}
          {!isService && (
            <div className="b-promo b-promo-spring">
              <Info className="w-4 h-4 shrink-0" />
              {/* راند ۱۹: truncate حذف شد — جملهٔ راهنما در موبایل نصفه دیده نمی‌شد؛ حالا می‌شکند */}
              <span className="leading-snug">
                {u.hasPendingChanges
                  ? "درخواست تغییر شما در انتظار تایید بالادستی است."
                  : "برای تغییر مشخصات، درخواست ثبت کنید و مدیر (بالادستی) تایید کند."}
              </span>
            </div>
          )}

          {/* تاریخچه درخواست‌ها */}
          {reqData && reqData.requests.length > 0 && (
            <div className="b-card p-5">
              <b className="text-[13.5px] block mb-4">درخواست‌های تغییر من</b>
              <div className="flex flex-col gap-2.5">
                {reqData.requests.slice(0, 5).map((r) => (
                  <div key={r.id} className="b-card-sm !rounded-xl p-3.5 flex flex-wrap items-center gap-3">
                    {r.status === "PENDING" && <span className="b-badge b-badge-warning"><Clock className="w-3 h-3 inline ml-1" /> در انتظار</span>}
                    {r.status === "APPROVED" && <span className="b-badge b-badge-spring"><CheckCircle2 className="w-3 h-3 inline ml-1" /> تایید و اعمال شد</span>}
                    {r.status === "REJECTED" && <span className="b-badge b-badge-critical"><XCircle className="w-3 h-3 inline ml-1" /> رد شد</span>}
                    <span className="text-[12px]">
                      {Object.keys(r.changes).map((f) => FIELD_LABELS[f] ?? f).join("، ")}
                    </span>
                    <span className="text-[10.5px] text-stone ms-auto">{relativeTimeFa(r.createdAt)}</span>
                    {r.status === "REJECTED" && r.reviewNote && (
                      <span className="text-[11px] text-destructive w-full">علت: {r.reviewNote}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: IdCard, label: "نام پدر", value: u.fatherName ?? "—" },
              { icon: UserRound, label: "جنسیت", value: GENDER_LABELS[u.gender ?? ""] ?? "—" },
              { icon: UserRound, label: "تاریخ تولد", value: u.birthDate ? formatDateFa(u.birthDate) : "—" },
              { icon: MapPin, label: "محل تولد", value: u.birthPlace ?? "—" },
              { icon: Phone, label: "موبایل", value: u.phone ?? "—", mono: true },
              { icon: Phone, label: "شماره شاد", value: u.shadNumber ?? "—", mono: true },
              { icon: Phone, label: "تلفن منزل", value: u.homePhone ?? "—", mono: true },
              { icon: MapPin, label: "آدرس", value: u.address ?? "—" },
              { icon: IdCard, label: "کد پستی", value: u.postalCode ?? "—", mono: true },
              { icon: GraduationCap, label: "مدرک تحصیلی", value: u.education ?? "—" },
              { icon: GraduationCap, label: "رشته تحصیلی", value: u.fieldOfStudy ?? "—" },
              { icon: ShieldCheck, label: "کد پرسنلی", value: u.staffCode ?? "—", mono: true },
              { icon: GraduationCap, label: "شغل", value: u.jobTitle ?? "—" },
            ].map((r) => (
              <div key={r.label} className="b-card-sm p-4 flex items-center gap-3">
                <r.icon className="w-5 h-5 text-spring shrink-0" />
                <span className="flex flex-col min-w-0">
                  <span className="text-[10.5px] text-steel">{r.label}</span>
                  <b className={`text-[13px] truncate ${r.mono ? "font-mono" : ""}`} dir={r.mono ? "ltr" : "rtl"}>{r.value}</b>
                </span>
              </div>
            ))}
          </div>

          {u.studentProfile && (
            <div className="b-card-md p-6">
              <h3 className="font-bold text-[15px] mb-4">اطلاعات دانش‌آموزی</h3>
              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                {[
                  { label: "کلاس", value: u.studentProfile.class?.name ?? "—" },
                  { label: "شماره دانش‌آموزی", value: u.studentProfile.studentNumber },
                  { label: "سال ورود", value: u.studentProfile.entryYear ?? "—" },
                  { label: "مدرسه قبلی", value: u.studentProfile.previousSchool ?? "—" },
                  { label: "یادداشت سلامت", value: u.studentProfile.healthNotes ?? "—" },
                ].map((r) => (
                  <div key={r.label} className="b-card-sm !rounded-xl p-3.5">
                    <div className="text-[10.5px] text-steel">{r.label}</div>
                    <b className="text-[13px]">{r.value}</b>
                  </div>
                ))}
              </div>
              <h4 className="font-bold text-[13.5px] mb-3">اطلاعات اولیا</h4>
              <div className="grid sm:grid-cols-2 gap-3">
                {u.studentProfile.parents.map((p) => (
                  <div key={p.parentUser.id} className="b-card-sm !rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <b className="text-[13px]">{p.parentUser.firstName} {p.parentUser.lastName}</b>
                      <span className="b-badge b-badge-spring">{PARENT_RELATION_LABELS[p.relation] ?? p.relation}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-[11.5px] text-steel">
                      <span dir="ltr" className="font-mono">کد ملی: {p.parentUser.nationalId}</span>
                      {p.parentUser.phone && <span dir="ltr" className="font-mono">موبایل: {p.parentUser.phone}</span>}
                      {p.parentUser.shadNumber && <span dir="ltr" className="font-mono">شاد: {p.parentUser.shadNumber}</span>}
                      {p.parentUser.jobTitle && <span>شغل: {p.parentUser.jobTitle}</span>}
                      {p.parentUser.education && <span>تحصیلات: {p.parentUser.education}</span>}
                    </div>
                  </div>
                ))}
                {u.studentProfile.parents.length === 0 && <p className="t-sm text-steel">ولی ثبت نشده است.</p>}
              </div>
            </div>
          )}
        </>
      )}

      {/* تغییر رمز */}
      <div id="change-pw" className="b-card-md p-6 md:p-8">
        <h3 className="font-bold text-[15px] mb-2 flex items-center gap-2">
          <KeyRound className="w-5 h-5 text-spring" /> تغییر رمز عبور
        </h3>
        <p className="t-sm text-steel mb-5">
          {data?.user.mustChangePassword
            ? "رمز فعلی شما تصادفی است؛ برای امنیت، همین حالا آن را عوض کنید."
            : "رمز عبور حداقل ۸ نویسه با حرف و رقم."}
        </p>
        <form onSubmit={changePassword} className="grid sm:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold">رمز فعلی *</span>
            <input type="password" dir="ltr" className="b-input" value={cur} onChange={(e) => setCur(e.target.value)} required autoComplete="current-password" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold">رمز جدید *</span>
            <input type="password" dir="ltr" className="b-input" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold">تکرار رمز جدید *</span>
            <input type="password" dir="ltr" className="b-input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={saving} className="b-btn b-btn-spring">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "تغییر رمز"}
            </button>
          </div>
        </form>
      </div>

      {/* ───────── امنیت: ورود دو مرحله‌ای (TOTP) — راند ۱۶ ───────── */}
      <TwoFactorCard />

      {/* ───────── ویرایش مشخصات (با تایید بالادستی) ───────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !submitting && setEditing(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">ویرایش مشخصات من</h2>
            <p className="t-sm text-steel mb-6">
              {isService
                ? "نقش‌های سرویس مستقیماً ذخیره می‌شوند (فیلدهای پایه)."
                : `پس از ثبت، درخواست به ${u?.role === "MANAGER" ? "ادمین سرویس" : "مدیر مدرسه"} ارسال می‌شود و پس از تایید، تغییرات اعمال می‌شود.`}
            </p>
            <form onSubmit={submitChanges} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {(isService ? EDITABLE_FIELDS.filter((f) => ["firstName", "lastName", "phone", "email"].includes(f.key)) : EDITABLE_FIELDS).map((f) => (
                  <label key={f.key} className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{f.label}</span>
                    {f.select ? (
                      <Select
                        className="w-full"
                        buttonClassName="!w-full"
                        value={editForm[f.key] ?? ""}
                        onChange={(v) => setEditForm((ef) => ({ ...ef, [f.key]: v }))}
                        options={[{ value: "", label: "—" }, { value: "MALE", label: "مرد" }, { value: "FEMALE", label: "زن" }]}
                        placeholder="—"
                      />
                    ) : (
                      <input
                        className="b-input"
                        dir={f.ltr ? "ltr" : "rtl"}
                        value={editForm[f.key] ?? ""}
                        onChange={(e) => setEditForm((ef) => ({ ...ef, [f.key]: e.target.value }))}
                      />
                    )}
                  </label>
                ))}
              </div>
              <label className={isService ? "hidden" : "flex flex-col gap-1.5"}>
                <span className="text-[12.5px] font-bold">دلیل تغییر (اختیاری)</span>
                <input className="b-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="مثلا: شماره موبایل عوض شده…" />
              </label>
              <div className="flex items-center gap-3">
                <button type="submit" disabled={submitting} className="b-btn b-btn-spring">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} ثبت درخواست
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setEditing(false)}>انصراف</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── خروج از حساب — در موبایل (بدون سایدبار/همبرگر) تنها مسیر خروج همین‌جاست ── */}
      <div className="b-card-sm !rounded-2xl p-4 flex items-center gap-3">
        <span className="w-10 h-10 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
          <LogOut className="w-5 h-5 flip-rtl" />
        </span>
        <div className="flex-1 min-w-0">
          <b className="text-[13px] block">خروج از حساب</b>
          <p className="text-[11.5px] text-steel leading-relaxed">نشست این دستگاه بسته می‌شود؛ ورود دوباره با کد ملی و رمز عبور.</p>
        </div>
        <button type="button" onClick={doLogout} disabled={loggingOut} className="b-btn b-btn-sm !bg-destructive !text-destructive-foreground shrink-0">
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : "خروج"}
        </button>
      </div>
    </div>
  );
}
