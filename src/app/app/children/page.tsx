"use client";

import Link from "next/link";
import { Baby, BarChart3, ClipboardCheck, MessageCircle } from "lucide-react";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, EmptyState, StatCard, ErrorBox } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import { faNumber, PARENT_RELATION_LABELS } from "@/lib/persian";

type Me = {
  user: {
    children: Array<{
      relation: string;
      student: {
        id: string;
        studentNumber: string;
        class: { name: string } | null;
        user: {
          id: string; firstName: string; lastName: string;
          profileImageType: "upload" | "avatar" | null;
          photoUrl: string | null;
          avatar: import("@/lib/avatar").AvatarParams | null;
        };
        parents: Array<{ relation: string; parentUser: { firstName: string; lastName: string } }>;
      };
    }>;
  };
};

type Dashboard = {
  stats: { children: number; unread: number; pendingChanges: number };
  children: Array<{
    relation: string;
    studentId: string;
    student: {
      name: string;
      class: string;
      gpa: number | null;
      absences: number;
      lates: number;
      attendanceRate: number | null;
      behaviorPoints: number;
    };
  }>;
};

export default function ChildrenPage() {
  const { data: meData, loading, error: meError } = useApi<Me>("/api/auth/me");
  const { data: dash, error: dashError } = useApi<Dashboard>("/api/dashboard");

  if (loading) return <LoadingBlock />;
  // خطای بارگذاری اطلاعات پایه — بدون آن صفحه معنا ندارد
  if (meError) return <ErrorBox message={meError} />;

  const children = meData?.user.children ?? [];
  const stats = dash?.children ?? [];
  const gpaValues = stats.map((s) => s.student.gpa).filter((g): g is number => g !== null);
  const avgGpa = gpaValues.length ? +(gpaValues.reduce((s, g) => s + g, 0) / gpaValues.length).toFixed(2) : null;
  const totalAbsences = stats.reduce((s, c) => s + c.student.absences, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="فرزندانم"
        desc="خلاصه وضعیت تحصیلی فرزندان شما در مدرسه."
      />

      {children.length === 0 && (
        <EmptyState
          icon={Baby}
          title="فرزندی به حساب شما متصل نیست"
          desc="برای اتصال حساب شما به فرزندتان، با مدیر مدرسه هماهنگ کنید."
        />
      )}

      {children.length > 0 && (
        <>
          {dashError && (
            <p className="b-card-sm p-3 text-[12px] text-warning-deep">
              آمار تحصیلی فعلاً در دسترس نیست ({dashError}) — اطلاعات فرزندان زیر به‌روز است.
            </p>
          )}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Baby} label="فرزند" value={children.length} tone="spring" />
            <StatCard icon={BarChart3} label="میانگین کل فرزندان" value={avgGpa !== null ? faNumber(avgGpa) : "—"} tone="ink" hint="از ۲۰" />
            <StatCard icon={ClipboardCheck} label="جمع غیبت‌ها" value={faNumber(totalAbsences)} />
            <StatCard icon={MessageCircle} label="پیام نخوانده" value={faNumber(dash?.stats?.unread ?? 0)} />
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {children.map((c) => {
              const st = stats.find((s) => s.studentId === c.student.id);
              return (
                <div key={c.student.id} className="b-card-md p-6 flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar user={c.student.user} size={48} />
                      <div className="flex flex-col min-w-0">
                        <b className="text-[15px] truncate">{c.student.user.firstName} {c.student.user.lastName}</b>
                        <span className="text-[11.5px] text-steel">
                          {PARENT_RELATION_LABELS[c.relation] ?? c.relation} · کلاس {c.student.class?.name ?? "—"}
                        </span>
                      </div>
                    </div>
                    <span className="b-badge b-badge-spring shrink-0" dir="ltr">{c.student.studentNumber}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="b-card-sm !rounded-xl p-3">
                      <div className="text-[18px] font-bold">{st?.student.gpa !== null && st?.student.gpa !== undefined ? faNumber(st.student.gpa) : "—"}</div>
                      <div className="text-[10.5px] text-steel">میانگین از ۲۰</div>
                    </div>
                    <div className="b-card-sm !rounded-xl p-3">
                      <div className="text-[18px] font-bold">{faNumber(st?.student.absences ?? 0)}</div>
                      <div className="text-[10.5px] text-steel">غیبت</div>
                    </div>
                    <div className="b-card-sm !rounded-xl p-3">
                      <div className="text-[18px] font-bold">{st?.student.attendanceRate !== null && st?.student.attendanceRate !== undefined ? faNumber(st.student.attendanceRate) + "٪" : "—"}</div>
                      <div className="text-[10.5px] text-steel">درصد حضور</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/app/grades`} className="b-btn b-btn-soft b-btn-sm flex-1 justify-center">
                      <BarChart3 className="w-3.5 h-3.5" /> کارنامه
                    </Link>
                    <Link href="/app/attendance" className="b-btn b-btn-soft b-btn-sm flex-1 justify-center">
                      <ClipboardCheck className="w-3.5 h-3.5" /> حضور و غیاب
                    </Link>
                    <Link href="/app/messages" className="b-btn b-btn-ghost b-btn-sm flex-1 justify-center">
                      <MessageCircle className="w-3.5 h-3.5" /> پیام معلم
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
