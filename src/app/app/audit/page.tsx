"use client";

import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { formatDateTimeFa } from "@/lib/persian";
import { History } from "lucide-react";

type Log = {
  id: string; userName: string | null; action: string; entityType: string | null;
  entityId: string | null; meta: string | null; schoolId: string | null; createdAt: string;
};

/** برچسب فارسی همهٔ اکشن‌های انگلیسی — اکشن‌های فارسی‌نویسی‌شده خودشان نمایش داده می‌شوند */
const LABELS: Record<string, string> = {
  LOGIN: "ورود به سامانه",
  LOGOUT: "خروج",
  CHANGE_PASSWORD: "تغییر رمز عبور",
  CREATE_USER: "ایجاد کاربر",
  UPDATE_USER: "ویرایش کاربر",
  RESET_USER_PASSWORD: "بازنشانی رمز کاربر",
  DEACTIVATE_USER: "غیرفعال‌سازی کاربر",
  DELETE_USER: "حذف کاربر",
  UPDATE_OWN_PROFILE: "ویرایش پروفایل خود",
  REQUEST_PROFILE_CHANGE: "درخواست تغییر مشخصات",
  APPROVE_PROFILE_CHANGE: "تایید تغییر مشخصات",
  REJECT_PROFILE_CHANGE: "رد تغییر مشخصات",
  CREATE_SCHOOL: "ایجاد مدرسه",
  UPDATE_SCHOOL: "ویرایش مدرسه",
  DELETE_SCHOOL: "حذف مدرسه",
  DEACTIVATE_SCHOOL: "غیرفعال‌سازی مدرسه",
  ENTER_SCHOOL_PANEL: "ورود به پنل مدرسه",
  CREATE_STUDENT: "ایجاد دانش‌آموز",
  UPDATE_STUDENT: "ویرایش دانش‌آموز",
  DEACTIVATE_STUDENT: "غیرفعال‌سازی دانش‌آموز",
  CREATE_CLASS: "ایجاد کلاس",
  UPDATE_CLASS: "ویرایش کلاس",
  ARCHIVE_CLASS: "بایگانی کلاس",
  CREATE_SUBJECT: "ایجاد درس",
  UPDATE_SUBJECT: "ویرایش درس",
  DELETE_SUBJECT: "حذف درس",
  CREATE_TEACHING: "تخصیص معلم",
  REASSIGN_TEACHER: "جایگزینی معلم",
  DELETE_TEACHING: "حذف تخصیص معلم",
  SAVE_SCHEDULE: "ذخیره برنامه هفتگی",
  SAVE_ATTENDANCE: "ثبت حضور و غیاب",
  SAVE_GRADES: "ثبت نمرات",
  GRADE_LOCK: "قفل نمرات",
  GRADE_UNLOCK: "بازگشایی نمرات",
  UNDO_GRADE: "بازگردانی نمره",
  CREATE_ASSIGNMENT: "ایجاد تکلیف",
  UPDATE_ASSIGNMENT: "ویرایش تکلیف",
  DELETE_ASSIGNMENT: "حذف تکلیف",
  CREATE_EVENT: "ایجاد رویداد",
  UPDATE_EVENT: "ویرایش رویداد",
  DELETE_EVENT: "حذف رویداد",
  CREATE_ANNOUNCEMENT: "ارسال اطلاعیه",
  UPDATE_ANNOUNCEMENT: "ویرایش اطلاعیه",
  DELETE_ANNOUNCEMENT: "حذف اطلاعیه",
  CREATE_FEE: "ایجاد قلم مالی",
  UPDATE_FEE: "تغییر قلم مالی",
  DELETE_FEE: "حذف قلم مالی",
  CREATE_TICKET: "ثبت تیکت",
  TICKET_REPLY: "پاسخ تیکت",
  TICKET_STATUS: "تغییر وضعیت تیکت",
  CREATE_BACKUP: "ایجاد نسخه پشتیبان",
  DELETE_BACKUP: "حذف نسخه پشتیبان",
  DOWNLOAD_BACKUP: "دانلود نسخه پشتیبان",
  RESTORE_BACKUP: "بازیابی نسخه پشتیبان",
  UPDATE_SETTINGS: "تغییر تنظیمات",
  UPDATE_SCHOOL_SITE: "به‌روزرسانی سایت مدرسه",
  CREATE_BLOG_POST: "ایجاد پست بلاگ",
  UPDATE_BLOG_POST: "ویرایش پست بلاگ",
  DELETE_BLOG_POST: "حذف پست بلاگ",
  MODERATE_COMMENT: "بازبینی نظر",
  SHAD_CONNECT: "اتصال درگاه شاد",
  SHAD_REVOKE: "قطع اتصال شاد",
  SHAD_DELIVER_CREDENTIALS: "ارسال اعتبارنامه با شاد",
  SHAD_SEND_NOTICE: "پیام اطلاع‌رسانی شاد",
  PROFILE_IMAGE_UPLOAD: "بارگذاری تصویر پروفایل",
  PROFILE_IMAGE_SET: "تنظیم تصویر پروفایل",
  PROFILE_IMAGE_DELETE: "حذف تصویر پروفایل",
  UPLOAD_MEDIA: "بارگذاری فایل",
  UPLOAD_APP_FILE: "بارگذاری فایل اپ",
  FEATURE_BADGE: "انتخاب نشان ویژه",
  IMPERSONATE_START: "شروع مشاهده‌جانشینی",
  IMPERSONATE_END: "پایان مشاهده‌جانشینی",
  FORCE_LOGOUT_ALL: "خروج اجباری همه نشست‌ها",
  BULK_STUDENTS: "عملیات گروهی دانش‌آموزان",
  CSV_EXPORT: "خروجی CSV",
  IMPORT_STUDENTS: "ایمپورت دانش‌آموزان",
};

const TYPE_COLORS: Record<string, string> = {
  USER: "b-badge-neutral",
  SCHOOL: "b-badge-spring",
  STUDENT: "b-badge-blossom",
  CLASS: "b-badge-neutral",
  TEACHING: "b-badge-neutral",
  SUBJECT: "b-badge-neutral",
  ASSIGNMENT: "b-badge-neutral",
  EVENT: "b-badge-neutral",
  ANNOUNCEMENT: "b-badge-neutral",
  FEE: "b-badge-warning",
  TICKET: "b-badge-neutral",
  BACKUP: "b-badge-spring",
  SETTINGS: "b-badge-spring",
  BLOG_POST: "b-badge-neutral",
  SHAD: "b-badge-spring",
  SHAD_SESSION: "b-badge-spring",
  SCHOOL_SITE: "b-badge-spring",
  ScheduleSlot: "b-badge-neutral",
  StudentBadge: "b-badge-blossom",
  Badge: "b-badge-blossom",
  LeaveRequest: "b-badge-neutral",
  Meeting: "b-badge-neutral",
  GradeRecord: "b-badge-warning",
};

/** آیا متن اساساً فارسی است؟ (اکشن‌های فارسی مستقیم نمایش داده می‌شوند) */
function isPersian(s: string): boolean {
  return /[\u0600-\u06FF]/.test(s);
}

export default function AuditPage() {
  const { data, loading, error } = useApi<{ logs: Log[] }>("/api/audit?limit=100");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="گزارش فعالیت"
        desc="ثبت خودکار همه رخدادهای مهم سامانه — شفافیت کامل برای مدیریت."
      />

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.logs.length === 0 && <EmptyState icon={History} title="رخدادی ثبت نشده" />}

      {data && data.logs.length > 0 && (
        <div className="b-card-sm overflow-hidden">
          <div className="max-h-[560px] overflow-auto b-scroll">
            <table className="w-full text-[12.5px]">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b border-hairline-soft text-steel text-[11px]">
                  <th className="text-right py-3 px-4 font-bold">زمان</th>
                  <th className="text-right py-3 px-4 font-bold">کاربر</th>
                  <th className="text-right py-3 px-4 font-bold">رخداد</th>
                  <th className="text-right py-3 px-4 font-bold hidden md:table-cell">موجودیت</th>
                  <th className="text-right py-3 px-4 font-bold hidden lg:table-cell">جزئیات</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((l) => {
                  let metaStr = "";
                  if (l.meta) {
                    try {
                      const m = JSON.parse(l.meta) as Record<string, unknown>;
                      metaStr = Object.entries(m)
                        .filter(([, v]) => v !== null && v !== undefined && v !== "")
                        .slice(0, 3)
                        .map(([k, v]) => {
                          const val = Array.isArray(v) ? `${v.length} مورد` : String(v);
                          return `${META_LABELS[k] ?? k}: ${val.length > 40 ? val.slice(0, 40) + "…" : val}`;
                        })
                        .join(" · ");
                    } catch {
                      metaStr = "";
                    }
                  }
                  return (
                    <tr key={l.id} className="b-row border-b border-hairline-soft/60 last:border-0">
                      <td className="py-2.5 px-4 text-steel whitespace-nowrap">{formatDateTimeFa(l.createdAt)}</td>
                      <td className="py-2.5 px-4"><b>{l.userName ?? "سیستم"}</b></td>
                      <td className="py-2.5 px-4">{LABELS[l.action] ?? (isPersian(l.action) ? l.action : l.action)}</td>
                      <td className="py-2.5 px-4 hidden md:table-cell">
                        <span className={`b-badge ${TYPE_COLORS[l.entityType ?? ""] ?? "b-badge-neutral"}`}>
                          {ENTITY_LABELS[l.entityType ?? ""] ?? l.entityType ?? "—"}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-steel text-[11px] hidden lg:table-cell max-w-[260px] truncate" title={metaStr}>
                        {metaStr || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

const ENTITY_LABELS: Record<string, string> = {
  USER: "کاربر",
  SCHOOL: "مدرسه",
  STUDENT: "دانش‌آموز",
  CLASS: "کلاس",
  TEACHING: "تخصیص",
  SUBJECT: "درس",
  ASSIGNMENT: "تکلیف",
  EVENT: "رویداد",
  ANNOUNCEMENT: "اطلاعیه",
  FEE: "قلم مالی",
  TICKET: "تیکت",
  BACKUP: "پشتیبان",
  SETTINGS: "تنظیمات",
  BLOG_POST: "پست",
  SHAD: "شاد",
  SHAD_SESSION: "نشست شاد",
  SCHOOL_SITE: "سایت مدرسه",
  ScheduleSlot: "برنامه",
  StudentBadge: "نشان",
  Badge: "نشان",
  LeaveRequest: "مرخصی",
  Meeting: "ملاقات",
  GradeRecord: "نمره",
};

const META_LABELS: Record<string, string> = {
  role: "نقش",
  nationalId: "کد ملی",
  title: "عنوان",
  status: "وضعیت",
  fields: "فیلدها",
  count: "تعداد",
  subjectId: "درس",
  term: "نیمسال",
  reason: "دلیل",
  name: "نام",
  shadDelivery: "ارسال شاد",
  from: "از",
  to: "به",
  edited: "ویرایش",
  studentId: "دانش‌آموز",
  badgeId: "نشان",
  scenario: "گزینه",
  slots: "زنگ‌ها",
  classes: "کلاس‌ها",
  action: "عمل",
  kind: "نوع",
  id: "شناسه",
};
