"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList, CheckCircle2, XCircle, Clock, UserRound, Loader2 } from "lucide-react";
import { useApi, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, RoleBadge } from "@/components/shared/bits";
import { formatDateTimeFa, relativeTimeFa } from "@/lib/persian";

type ChangeRequest = {
  id: string;
  userId: string;
  changes: Record<string, { from: string | null; to: string }>;
  reason: string | null;
  status: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; role: string; nationalId: string; schoolId: string | null; school: { name: string } | null };
  roleLabel: string;
};

const FIELD_LABELS: Record<string, string> = {
  firstName: "نام", lastName: "نام خانوادگی", fatherName: "نام پدر", gender: "جنسیت",
  birthPlace: "محل تولد", birthDate: "تاریخ تولد", phone: "موبایل", homePhone: "تلفن خانه",
  email: "ایمیل", address: "آدرس", postalCode: "کد پستی", shadNumber: "شماره شاد",
  education: "مدرک تحصیلی", fieldOfStudy: "رشته تحصیلی", jobTitle: "شغل", photoUrl: "تصویر پروفایل",
};

export default function ApprovalsPage() {
  const { data, loading, error, refetch } = useApi<{ requests: ChangeRequest[] }>("/api/profile-requests?scope=inbox");
  const [busy, setBusy] = useState<string | null>(null);
  // یادداشت جداگانه برای هر درخواست — قبلاً یک state مشترک بود و یادداشتِ یک کارت برای درخواست دیگر ارسال می‌شد
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function review(id: string, approve: boolean) {
    setBusy(id);
    try {
      await apiPatch(`/api/profile-requests/${id}`, { approve, note: notes[id] || undefined });
      toast.success(approve ? "تغییرات تایید و اعمال شد." : "درخواست رد شد.");
      setNotes((ns) => ({ ...ns, [id]: "" }));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="تایید تغییر مشخصات"
        desc="کاربران مدرسه (دانش‌آموز/ولی/معاون/معلم) تغییر مشخصات خود را درخواست می‌دهند و شما به‌عنوان بالادستی تایید می‌کنید. درخواست مدیران مدرسه را ادمین‌های سرویس بررسی می‌کنند."
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.requests.length === 0 && (
        <EmptyState
          icon={ClipboardList}
          title="صف تایید خالی است"
          desc="درخواست تغییری در انتظار بررسی نیست. کاربران از صفحه «پروفایل» درخواست ثبت می‌کنند."
        />
      )}

      {data && data.requests.length > 0 && (
        <div className="flex flex-col gap-4">
          {data.requests.map((r) => (
            <div key={r.id} className="b-card p-5">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <span className="w-10 h-10 rounded-full bg-spring-tint text-spring flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <b className="text-[14px] block truncate">{r.user.firstName} {r.user.lastName}</b>
                  <span className="text-[11.5px] text-steel">
                    <RoleBadge role={r.user.role} /> {r.user.school?.name ?? ""} — <span dir="ltr" className="font-mono">{r.user.nationalId}</span>
                  </span>
                </div>
                <span className="text-[10.5px] text-stone shrink-0">{relativeTimeFa(r.createdAt)}</span>
              </div>

              <div className="b-card-sm !rounded-xl overflow-hidden mb-4">
                <div className="overflow-x-auto b-scroll">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="border-b border-hairline-soft text-steel text-[11px]">
                        <th className="text-right py-2 px-3 font-bold">فیلد</th>
                        <th className="text-right py-2 px-3 font-bold">مقدار فعلی</th>
                        <th className="text-right py-2 px-3 font-bold">درخواست جدید</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(r.changes).map(([field, diff]) => (
                        <tr key={field} className="border-b border-hairline-soft/50 last:border-0">
                          <td className="py-2 px-3 font-bold">{FIELD_LABELS[field] ?? field}</td>
                          <td className="py-2 px-3 text-steel" dir="auto">{diff.from || "—"}</td>
                          <td className="py-2 px-3 text-spring-deep dark:text-spring-soft font-bold" dir="auto">{diff.to || "خالی"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {r.reason && (
                <p className="text-[12px] text-steel mb-4">دلیل کاربر: «{r.reason}»</p>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <input
                  className="b-input flex-1 min-w-[200px] !h-10"
                  placeholder="یادداشت بررسی (اختیاری)…"
                  value={notes[r.id] ?? ""}
                  onChange={(e) => setNotes((ns) => ({ ...ns, [r.id]: e.target.value }))}
                />
                <button className="b-btn b-btn-spring b-btn-sm" onClick={() => review(r.id, true)} disabled={busy === r.id}>
                  {busy === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  تایید و اعمال
                </button>
                <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={() => review(r.id, false)} disabled={busy === r.id}>
                  <XCircle className="w-3.5 h-3.5" /> رد
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
