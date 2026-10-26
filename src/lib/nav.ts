import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, LibraryBig,
  CalendarDays, ClipboardCheck, BarChart3, NotebookPen, Sparkles, BellRing,
  MessageCircle, Send, History, UserRound, Baby, Settings, Newspaper,
  LifeBuoy, ClipboardList, Wallet, Globe, CheckCheck, DoorOpen, Award,
  HeartHandshake, FileQuestion, Link2, Handshake, CalendarOff, ListTodo,
  Zap, Wrench, Vote, ScrollText, FileBarChart, ShieldAlert, HeartPulse,
  Home, MessagesSquare, Coins, SlidersHorizontal, Building2, FileUp,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// بهار | فهرست ناوبری مشترک — سایدبار دسکتاپ + لانچر موبایل
// (استخراج‌شده از app-shell تا داشبورد هم از همان منبع تغذیه شود)
// راند ۱۸: گروه‌بندی برای لانچر دسته‌بندی‌شدهٔ موبایل اضافه شد.
// ============================================================

export type NavGroupKey = "personal" | "education" | "students" | "comms" | "finance" | "admin" | "services";

export const NAV_GROUPS: { key: NavGroupKey; label: string; icon: LucideIcon }[] = [
  { key: "personal", label: "شخصی", icon: Home },
  { key: "education", label: "آموزش", icon: BookOpen },
  { key: "students", label: "دانش‌آموزان", icon: GraduationCap },
  { key: "comms", label: "ارتباطات", icon: MessagesSquare },
  { key: "finance", label: "امور مالی", icon: Coins },
  { key: "admin", label: "مدیریت", icon: SlidersHorizontal },
  { key: "services", label: "سرویس مدرسه", icon: Building2 },
];

export type NavItem = {
  href: string;
  label: string;
  short: string;
  tKey?: string; // کلید ترجمه بسته زبان — بدون تعریف، همان label فارسی
  icon: LucideIcon;
  roles: string[];
  permission?: string;
  badgeKey?: "unread" | "approvals" | "tickets";
  /** تِینت آیکون لانچر موبایل — چرخش رنگی شبیه app-screen اندروید */
  tint?: 0 | 1 | 2 | 3;
  /** گروه لانچر موبایل (راند ۱۸) — ردیف افقی دسته‌بندی‌شده */
  group: NavGroupKey;
};

export const NAV: NavItem[] = [
  { href: "/app", label: "داشبورد", tKey: "shell.dashboard", short: "خانه", icon: LayoutDashboard, roles: ["*"], tint: 0, group: "personal" },
  { href: "/app/schools", label: "مدارس", tKey: "nav.schools", short: "مدارس", icon: School, roles: ["SUPER_ADMIN", "ADMIN"], permission: "view_schools", tint: 1, group: "admin" },
  { href: "/app/users", label: "کاربران", tKey: "nav.users", short: "کاربران", icon: Users, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], tint: 2, group: "admin" },
  { href: "/app/students", label: "دانش‌آموزان", tKey: "nav.students", short: "دانش‌آموز", icon: GraduationCap, roles: ["MANAGER", "DEPUTY"], permission: "manage_students", tint: 3, group: "students" },
  { href: "/app/classes", label: "کلاس‌ها", tKey: "nav.classes", short: "کلاس‌ها", icon: BookOpen, roles: ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"], tint: 0, group: "education" },
  { href: "/app/subjects", label: "درس‌ها", tKey: "nav.subjects", short: "درس‌ها", icon: LibraryBig, roles: ["MANAGER", "DEPUTY"], permission: "manage_subjects", tint: 1, group: "education" },
  { href: "/app/schedule", label: "برنامه هفتگی", tKey: "nav.schedule", short: "برنامه", icon: CalendarDays, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 2, group: "education" },
  { href: "/app/attendance", label: "حضور و غیاب", tKey: "nav.attendance", short: "حضور", icon: ClipboardCheck, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 3, group: "education" },
  { href: "/app/grades", label: "نمرات", tKey: "nav.grades", short: "نمرات", icon: BarChart3, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 0, group: "education" },
  { href: "/app/assignments", label: "تکالیف", tKey: "nav.assignments", short: "تکالیف", icon: NotebookPen, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 1, group: "education" },
  { href: "/app/tasks", label: "تسک‌ها و اقدامات", tKey: "nav.tasks", short: "تسک‌ها", icon: ListTodo, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "CUSTODIAN"], tint: 2, group: "admin" },
  { href: "/app/behavior", label: "انضباط و رفتار", tKey: "nav.behavior", short: "انضباط", icon: HeartHandshake, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 3, group: "students" },
  { href: "/app/badges", label: "بج‌ها و افتخارات", tKey: "nav.badges", short: "بج‌ها", icon: Award, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT", "SUPER_ADMIN"], tint: 0, group: "students" },
  { href: "/app/insights", label: "بینش‌ها و هشدار زودهنگام", tKey: "nav.insights", short: "بینش‌ها", icon: ShieldAlert, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 1, group: "students" },
  { href: "/app/wellbeing", label: "سلامت روان", tKey: "nav.wellbeing", short: "سلامت", icon: HeartPulse, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "STUDENT"], tint: 2, group: "students" },
  { href: "/app/question-bank", label: "بانک سوال", tKey: "nav.questionBank", short: "بانک سوال", icon: FileQuestion, roles: ["MANAGER", "DEPUTY", "TEACHER"], tint: 3, group: "education" },
  { href: "/app/resources", label: "منابع آموزشی", tKey: "nav.resources", short: "منابع", icon: Link2, roles: ["*"], tint: 0, group: "education" },
  { href: "/app/automation", label: "اتوماسیون", tKey: "nav.automation", short: "اتوماسیون", icon: Zap, roles: ["MANAGER", "SUPER_ADMIN"], tint: 1, group: "admin" },
  { href: "/app/facilities", label: "امکانات و اموال", tKey: "nav.facilities", short: "امکانات", icon: Wrench, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER", "CUSTODIAN"], tint: 2, group: "services" },
  { href: "/app/engagement", label: "نظرسنجی و پیشنهاد", tKey: "nav.engagement", short: "نظرسنجی", icon: Vote, roles: ["*"], tint: 3, group: "comms" },
  { href: "/app/certificates", label: "گواهی‌ها", tKey: "nav.certificates", short: "گواهی‌ها", icon: ScrollText, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 0, group: "students" },
  { href: "/app/reports", label: "گزارش‌ها و داده", tKey: "nav.reports", short: "گزارش‌ها", icon: FileBarChart, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 1, group: "admin" },
  { href: "/app/imports", label: "ایمپورت و اکسپورت", short: "ایمپورت", icon: FileUp, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 3, group: "admin" },
  { href: "/app/finance", label: "امور مالی", tKey: "nav.finance", short: "مالی", icon: Wallet, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "STUDENT", "PARENT"], tint: 2, group: "finance" },
  { href: "/app/meetings", label: "ملاقات‌ها", tKey: "nav.meetings", short: "ملاقات", icon: Handshake, roles: ["*"], tint: 3, group: "comms" },
  { href: "/app/leaves", label: "مرخصی‌ها", tKey: "nav.leaves", short: "مرخصی", icon: CalendarOff, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "CUSTODIAN"], tint: 0, group: "admin" },
  { href: "/app/events", label: "رویدادها", tKey: "nav.events", short: "رویدادها", icon: Sparkles, roles: ["*"], tint: 1, group: "comms" },
  { href: "/app/announcements", label: "اعلان‌ها", tKey: "nav.announcements", short: "اعلان‌ها", icon: BellRing, roles: ["*"], tint: 2, group: "comms" },
  { href: "/app/leads", label: "پیش‌ثبت‌نام‌ها", tKey: "nav.leads", short: "پیش‌ثبت‌نام", icon: CheckCheck, roles: ["MANAGER", "DEPUTY"], tint: 3, group: "students" },
  { href: "/app/website", label: "سایت مدرسه", tKey: "nav.website", short: "سایت", icon: Globe, roles: ["MANAGER", "SUPER_ADMIN", "ADMIN"], tint: 0, group: "services" },
  { href: "/app/messages", label: "پیام‌ها", tKey: "nav.messages", short: "پیام‌ها", icon: MessageCircle, roles: ["*"], badgeKey: "unread", tint: 1, group: "comms" },
  { href: "/app/shad", label: "شاد", tKey: "nav.shad", short: "شاد", icon: Send, roles: ["MANAGER", "DEPUTY"], permission: "send_shad", tint: 2, group: "services" },
  { href: "/app/tickets", label: "پشتیبانی", tKey: "nav.tickets", short: "پشتیبانی", icon: LifeBuoy, roles: ["*"], badgeKey: "tickets", tint: 3, group: "services" },
  { href: "/app/approvals", label: "تایید تغییرات", tKey: "nav.approvals", short: "تاییدها", icon: ClipboardList, roles: ["MANAGER", "SUPER_ADMIN", "ADMIN"], badgeKey: "approvals", tint: 0, group: "admin" },
  { href: "/app/blog", label: "بلاگ", tKey: "nav.blog", short: "بلاگ", icon: Newspaper, roles: ["SUPER_ADMIN", "ADMIN"], permission: "manage_blog", tint: 1, group: "comms" },
  { href: "/app/children", label: "فرزندانم", tKey: "nav.children", short: "فرزندان", icon: Baby, roles: ["PARENT"], tint: 2, group: "personal" },
  { href: "/app/audit", label: "گزارش فعالیت", tKey: "nav.audit", short: "گزارشها", icon: History, roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"], permission: "view_audit", tint: 3, group: "admin" },
  { href: "/app/settings", label: "تنظیمات سامانه", tKey: "settings.title", short: "تنظیمات", icon: Settings, roles: ["SUPER_ADMIN"], tint: 0, group: "admin" },
  { href: "/app/profile", label: "پروفایل", tKey: "shell.profile", short: "پروفایل", icon: UserRound, roles: ["*"], tint: 1, group: "personal" },
];

/** فیلتر مشترک آیتم‌های ناوبری بر اساس نقش/دسترسی/پنل مدرسه (هم‌ارز منطق قبلی app-shell) */
export function navItemsFor(
  role: string,
  permissions: string[],
  inSchoolPanel: boolean
): NavItem[] {
  return NAV.filter((n) => {
    const roleOk = n.roles.includes("*") || n.roles.includes(role);
    if (!roleOk) {
      // سوپرادمین داخل پنل مدرسه هم آیتم‌های مدیریتی مدرسه را می‌بیند (مثل شاد)
      if (
        inSchoolPanel &&
        ["MANAGER", "DEPUTY"].some((r) => n.roles.includes(r)) &&
        (role === "ADMIN" || role === "SUPER_ADMIN")
      ) {
        // ok
      } else {
        return false;
      }
    }
    if (!n.permission) return true;
    if (["MANAGER", "SUPER_ADMIN"].includes(role)) return true;
    return permissions.includes(n.permission);
  });
}
