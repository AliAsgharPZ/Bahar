import {
  LayoutDashboard, School, Users, GraduationCap, BookOpen, LibraryBig,
  CalendarDays, ClipboardCheck, BarChart3, NotebookPen, Sparkles, BellRing,
  MessageCircle, Send, History, UserRound, Baby, Settings, Newspaper,
  LifeBuoy, ClipboardList, Wallet, Globe, CheckCheck, DoorOpen, Award,
  HeartHandshake, FileQuestion, Link2, Handshake, CalendarOff, ListTodo,
  Zap, Wrench, Vote, ScrollText, FileBarChart, ShieldAlert, HeartPulse,
  Home, MessagesSquare, Coins, SlidersHorizontal, Building2, FileUp,
  IdCard, Repeat,
  Bus, FileText, Video, Armchair, MessageSquareText, Landmark,
  CalendarSync, MessageSquare, UserPlus, Network, Trophy, UtensilsCrossed,
  Compass, MonitorPlay, Flame, Album, Terminal, Accessibility, FlaskConical, Puzzle,
  Eye, NotebookText, Bot, FileSignature, Package, FileBadge, BookMarked, PackageSearch, Cake, ShieldCheck, Lock, Shirt, Sunrise, Megaphone, UserCheck, Car, KeyRound, SprayCan, Target, BookCopy, Medal, HandHeart, PhoneCall, Scale, PackagePlus, Printer, CalendarPlus, Library, ArrowLeftRight, Heart, Clock, Pill, Siren, Podcast, Bike,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ============================================================
// بهار | فهرست ناوبری مشترک — سایدبار دسکتاپ + لانچر موبایل
// (استخراج‌شده از app-shell تا داشبورد هم از همان منبع تغذیه شود)
// راند ۱۸: گروه‌بندی برای لانچر دسته‌بندی‌شدهٔ موبایل اضافه شد.
// ============================================================

export type NavGroupKey = "personal" | "education" | "students" | "comms" | "finance" | "admin" | "services";

export const NAV_GROUPS: { key: NavGroupKey; label: string; tKey: string; icon: LucideIcon }[] = [
  { key: "personal", label: "شخصی", tKey: "nav.group.personal", icon: Home },
  { key: "education", label: "آموزش", tKey: "nav.group.education", icon: BookOpen },
  { key: "students", label: "دانش‌آموزان", tKey: "nav.group.students", icon: GraduationCap },
  { key: "comms", label: "ارتباطات", tKey: "nav.group.comms", icon: MessagesSquare },
  { key: "finance", label: "امور مالی", tKey: "nav.group.finance", icon: Coins },
  { key: "admin", label: "مدیریت", tKey: "nav.group.admin", icon: SlidersHorizontal },
  { key: "services", label: "سرویس مدرسه", tKey: "nav.group.services", icon: Building2 },
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
  { href: "/app/excuses", label: "توجیه غیبت", tKey: "nav.excuses", short: "توجیه غیبت", icon: FileQuestion, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/consents", label: "رضایت‌نامه‌ها", tKey: "nav.consents", short: "رضایت‌نامه", icon: FileSignature, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/held-items", label: "امانات و وسایل ضبط‌شده", tKey: "nav.heldItems", short: "امانات", icon: Package, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/document-requests", label: "درخواست مدرک", tKey: "nav.documents", short: "مدرک", icon: FileBadge, roles: ["MANAGER", "DEPUTY", "PARENT", "STUDENT", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/makeup-classes", label: "کلاس جبرانی", tKey: "nav.makeup", short: "جبرانی", icon: CalendarPlus, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/class-visits", label: "بازدید از کلاس", tKey: "nav.visits", short: "بازدید", icon: DoorOpen, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/fee-installments", label: "تقسیط شهریه", tKey: "nav.fees", short: "تقسیط", icon: Wallet, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/id-reissue", label: "کارت دانش‌آموزی", tKey: "nav.idcard", short: "کارت تازه", icon: IdCard, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/book-suggestions", label: "پیشنهاد کتاب", tKey: "nav.bookSug", short: "پیشنهاد کتاب", icon: Library, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/club-proposals", label: "پیشنهاد باشگاه", tKey: "nav.clubProp", short: "باشگاه تازه", icon: Sparkles, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/tutor-offers", label: "تدریس همتا", tKey: "nav.tutor", short: "تدریس همتا", icon: GraduationCap, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/help-board", label: "پرسش و پاسخ درسی", tKey: "nav.help", short: "پرسش درسی", icon: MessagesSquare, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/transfer-requests", label: "انتقال مدرسه", tKey: "nav.transfer", short: "انتقال", icon: ArrowLeftRight, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/science-fair", label: "جشنوارهٔ علمی", tKey: "nav.science", short: "جشنواره", icon: FlaskConical, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/sports-league", label: "لیگ داخلی", tKey: "nav.league", short: "لیگ", icon: Trophy, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/meal-orders", label: "پیش‌سفارش غذا", tKey: "nav.meals2", short: "غذا", icon: UtensilsCrossed, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/safety-reports", label: "گزارش ناشناس", tKey: "nav.safety", short: "گزارش ناشناس", icon: ShieldAlert, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/kindness-wall", label: "دیوار مهربانی", tKey: "nav.kindness", short: "مهربانی", icon: Heart, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/office-hours", label: "ساعات مراجعهٔ معلم", tKey: "nav.hours", short: "مراجعه", icon: Clock, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/medication-log", label: "ثبت دارو", tKey: "nav.meds", short: "دارو", icon: Pill, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/drill-log", label: "مانورهای ایمنی", tKey: "nav.drills", short: "مانور", icon: Siren, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/asset-loans", label: "امانت تجهیزات", tKey: "nav.loans", short: "امانت", icon: Wrench, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/podcast", label: "رادیو و پادکست", tKey: "nav.podcast", short: "پادکست", icon: Podcast, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/bike-registry", label: "دوچرخه و اسکوتر", tKey: "nav.bikes", short: "دوچرخه", icon: Bike, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/mentoring", label: "همیار دانش‌آموزی", tKey: "nav.mentoring", short: "همیار", icon: HeartHandshake, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/reading", label: "چالش کتاب‌خوانی", tKey: "nav.reading", short: "کتاب‌خوانی", icon: BookOpen, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/journal", label: "دفتر خاطرات", tKey: "nav.journal", short: "خاطرات", icon: NotebookPen, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/student-goals", label: "هدف‌گذاری تحصیلی", tKey: "nav.goals2", short: "هدف‌ها", icon: Target, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/book-exchange", label: "تبادل کتاب", tKey: "nav.books", short: "کتاب دست‌دوم", icon: BookCopy, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/sports-records", label: "رکوردهای ورزشی", tKey: "nav.sports", short: "رکوردها", icon: Medal, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/volunteer", label: "خدمت داوطلبانه", tKey: "nav.volunteer", short: "داوطلبی", icon: HandHeart, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/call-log", label: "دفتر تماس اولیا", tKey: "nav.calls", short: "تماس‌ها", icon: PhoneCall, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/grade-appeals", label: "اعتراض به نمره", tKey: "nav.appeals", short: "اعتراض نمره", icon: Scale, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/supply-requests", label: "درخواست لوازم", tKey: "nav.supply", short: "لوازم", icon: PackagePlus, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/print-requests", label: "چاپ و تکثیر", tKey: "nav.print", short: "چاپ", icon: Printer, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/transport-requests", label: "درخواست سرویس", tKey: "nav.transport2", short: "سرویس", icon: Bus, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/birthdays", label: "تولدها", tKey: "nav.birthdays", short: "تولدها", icon: Cake, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/pickup", label: "تحویل دانش‌آموز", tKey: "nav.pickup", short: "تحویل", icon: ShieldCheck, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/lockers", label: "کمدها", tKey: "nav.lockers", short: "کمدها", icon: Lock, roles: ["MANAGER", "DEPUTY", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/uniforms", label: "یونیفرم", tKey: "nav.uniforms", short: "یونیفرم", icon: Shirt, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/assembly", label: "صبحگاه", tKey: "nav.assembly", short: "صبحگاه", icon: Sunrise, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/duty-roster", label: "جدول کشیک", tKey: "nav.roster", short: "کشیک‌ها", icon: ClipboardList, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/elections", label: "انتخابات دانش‌آموزی", tKey: "nav.elections", short: "انتخابات", icon: Vote, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/campaigns", label: "پویش‌ها", tKey: "nav.campaigns", short: "پویش", icon: Megaphone, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/class-roles", label: "مسئولیت‌های کلاسی", tKey: "nav.classRoles", short: "مسئولیت", icon: UserCheck, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/parking", label: "مجوز خودرو", tKey: "nav.parking", short: "خودرو", icon: Car, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/keys-log", label: "دفتر کلیدها", tKey: "nav.keysLog", short: "کلیدها", icon: KeyRound, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "admin" },
  { href: "/app/cleaning", label: "نوبت نظافت", tKey: "nav.cleaning", short: "نظافت", icon: SprayCan, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/lost-found", label: "گمشده و پیداشده", tKey: "nav.lostFound", short: "گمشده‌ها", icon: PackageSearch, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/duty-logs", label: "دفتر کشیک", tKey: "nav.dutyLogs", short: "کشیک", icon: BookMarked, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 2, group: "admin" },
  { href: "/app/grades", label: "نمرات", tKey: "nav.grades", short: "نمرات", icon: BarChart3, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 0, group: "education" },
  { href: "/app/assignments", label: "تکالیف", tKey: "nav.assignments", short: "تکالیف", icon: NotebookPen, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 1, group: "education" },
  { href: "/app/homework-balance", label: "تعادل تکالیف", tKey: "nav.homeworkBalance", short: "تعادل تکالیف", icon: NotebookPen, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 1, group: "education" },
  { href: "/app/study-groups", label: "گروه‌های مطالعه", tKey: "nav.studyGroups", short: "گروه مطالعه", icon: Users, roles: ["MANAGER", "DEPUTY", "TEACHER"], tint: 2, group: "education" },
  { href: "/app/revision-plan", label: "برنامه مرور امتحان", tKey: "nav.revisionPlan", short: "مرور امتحان", icon: CalendarDays, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 3, group: "education" },
  { href: "/app/tasks", label: "تسک‌ها و اقدامات", tKey: "nav.tasks", short: "تسک‌ها", icon: ListTodo, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "CUSTODIAN"], tint: 2, group: "admin" },
  { href: "/app/behavior", label: "انضباط و رفتار", tKey: "nav.behavior", short: "انضباط", icon: HeartHandshake, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT"], tint: 3, group: "students" },
  { href: "/app/badges", label: "بج‌ها و افتخارات", tKey: "nav.badges", short: "بج‌ها", icon: Award, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT", "PARENT", "SUPER_ADMIN"], tint: 0, group: "students" },
  { href: "/app/insights", label: "بینش‌ها و هشدار زودهنگام", tKey: "nav.insights", short: "بینش‌ها", icon: ShieldAlert, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 1, group: "students" },
  { href: "/app/wellbeing", label: "سلامت روان", tKey: "nav.wellbeing", short: "سلامت", icon: HeartPulse, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "STUDENT"], tint: 2, group: "students" },
  { href: "/app/question-bank", label: "بانک سوال", tKey: "nav.questionBank", short: "بانک سوال", icon: FileQuestion, roles: ["MANAGER", "DEPUTY", "TEACHER"], tint: 3, group: "education" },
  { href: "/app/quizzes", label: "آزمون آنلاین", tKey: "nav.quizzes", short: "آزمون", icon: ClipboardList, roles: ["MANAGER", "DEPUTY", "TEACHER", "STUDENT"], tint: 1, group: "education" },
  { href: "/app/library", label: "کتابخانه", tKey: "nav.library", short: "کتابخانه", icon: LibraryBig, roles: ["*"], tint: 2, group: "education" },
  { href: "/app/clubs", label: "باشگاه‌ها", tKey: "nav.clubs", short: "باشگاه", icon: Trophy, roles: ["*"], tint: 3, group: "services" },
  { href: "/app/meals", label: "برنامه غذایی", tKey: "nav.meals", short: "غذا", icon: UtensilsCrossed, roles: ["*"], tint: 1, group: "services" },
  { href: "/app/wallet", label: "بوفه و کیف پول", tKey: "nav.wallet", short: "کیف پول", icon: Wallet, roles: ["*"], tint: 0, group: "services" },
  { href: "/app/portfolio", label: "پورتفولیو", tKey: "nav.portfolio", short: "پورتفولیو", icon: Sparkles, roles: ["STUDENT", "PARENT"], tint: 2, group: "personal" },
  { href: "/app/study", label: "برنامه مطالعه", tKey: "nav.study", short: "مطالعه", icon: Flame, roles: ["STUDENT", "PARENT"], tint: 1, group: "personal" },
  { href: "/app/guidance", label: "هدایت تحصیلی", tKey: "nav.guidance", short: "هدایت", icon: Compass, roles: ["*"], tint: 0, group: "education" },
  { href: "/app/observations", label: "مشاهدهٔ کلاس", tKey: "nav.observations", short: "مشاهده", icon: Eye, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 1, group: "education" },
  { href: "/app/minutes", label: "صورتجلسات", tKey: "nav.minutes", short: "جلسات", icon: NotebookText, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 2, group: "admin" },
  { href: "/app/fame", label: "دیوار افتخار", tKey: "nav.fame", short: "افتخار", icon: Trophy, roles: ["*"], tint: 3, group: "services" },
  { href: "/app/tv", label: "تابلوی مدرسه", tKey: "nav.tv", short: "تابلو", icon: MonitorPlay, roles: ["*"], tint: 2, group: "services" },
  { href: "/app/yearbook", label: "کتاب سال", tKey: "nav.yearbook", short: "کتاب سال", icon: Album, roles: ["*"], tint: 1, group: "services" },
  { href: "/app/substitutions", label: "جایگزینی معلم", tKey: "nav.substitutions", short: "جایگزینی", icon: Repeat, roles: ["MANAGER", "DEPUTY"], tint: 0, group: "education" },
  { href: "/app/id-cards", label: "کارت شناسایی", tKey: "nav.idCards", short: "کارت شناسایی", icon: IdCard, roles: ["MANAGER", "DEPUTY", "CUSTODIAN"], tint: 3, group: "students" },
  { href: "/app/virtual-sessions", label: "کلاس مجازی", tKey: "nav.virtualSessions", short: "کلاس مجازی", icon: Video, roles: ["*"], tint: 0, group: "education" },
  { href: "/app/seating", label: "چیدمان صندلی", tKey: "nav.seating", short: "صندلی", icon: Armchair, roles: ["MANAGER", "DEPUTY", "TEACHER"], tint: 1, group: "education" },
  { href: "/app/report-comments", label: "کامنت کارنامه", tKey: "nav.reportComments", short: "کامنت", icon: MessageSquareText, roles: ["MANAGER", "DEPUTY", "TEACHER"], tint: 2, group: "education" },
  { href: "/app/exams", label: "امتحانات", tKey: "nav.exams", short: "امتحان", icon: ClipboardList, roles: ["*"], tint: 3, group: "education" },
  { href: "/app/exam-seats", label: "صندلی امتحان و کارت", tKey: "nav.examSeats", short: "کارت امتحان", icon: Armchair, roles: ["MANAGER", "DEPUTY", "TEACHER", "ADMIN", "SUPER_ADMIN"], tint: 3, group: "education" },
  { href: "/app/descriptive-report", label: "کارنامه توصیفی", tKey: "nav.descriptiveReport", short: "توصیفی", icon: FileBarChart, roles: ["*"], tint: 0, group: "education" },
  { href: "/app/payroll", label: "حقوق و فیش", tKey: "nav.payroll", short: "حقوق", icon: Wallet, roles: ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"], tint: 1, group: "finance" },
  { href: "/app/sms", label: "پنل پیامک", tKey: "nav.sms", short: "پیامک", icon: MessageSquare, roles: ["MANAGER", "DEPUTY"], tint: 2, group: "comms" },
  { href: "/app/bots", label: "ربات‌ها و مینی‌اپ", tKey: "nav.bots", short: "ربات‌ها", icon: Bot, roles: ["MANAGER", "DEPUTY", "TEACHER", "PARENT", "STUDENT", "CUSTODIAN", "ADMIN", "SUPER_ADMIN"], tint: 2, group: "comms" },
  { href: "/app/rollover", label: "بستن سال تحصیلی", tKey: "nav.rollover", short: "بستن سال", icon: CalendarSync, roles: ["MANAGER"], tint: 3, group: "admin" },
  { href: "/app/transport", label: "سرویس مدرسه", tKey: "nav.transport", short: "سرویس", icon: Bus, roles: ["*"], tint: 1, group: "services" },
  { href: "/app/gate-passes", label: "مجوز خروج", tKey: "nav.gatePasses", short: "مجوز خروج", icon: DoorOpen, roles: ["*"], tint: 2, group: "students" },
  { href: "/app/alumni", label: "فارغ‌التحصیلان", tKey: "nav.alumni", short: "فارغ‌التحصیلان", icon: GraduationCap, roles: ["MANAGER", "DEPUTY"], tint: 3, group: "students" },
  { href: "/app/forms", label: "فرم‌ها و رضایت‌نامه‌ها", tKey: "nav.forms", short: "فرم‌ها", icon: FileText, roles: ["*"], tint: 0, group: "comms" },
  { href: "/app/staff-attendance", label: "حضور و غیاب کارکنان", tKey: "nav.staffAttendance", short: "حضور کارکنان", icon: ClipboardCheck, roles: ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN"], tint: 1, group: "personal" },
  { href: "/app/resources", label: "منابع آموزشی", tKey: "nav.resources", short: "منابع", icon: Link2, roles: ["*"], tint: 0, group: "education" },
  { href: "/app/automation", label: "اتوماسیون", tKey: "nav.automation", short: "اتوماسیون", icon: Zap, roles: ["MANAGER", "SUPER_ADMIN"], tint: 1, group: "admin" },
  { href: "/app/facilities", label: "امکانات و اموال", tKey: "nav.facilities", short: "امکانات", icon: Wrench, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER", "CUSTODIAN"], tint: 2, group: "services" },
  { href: "/app/venues", label: "محل‌ها و سالن‌ها", short: "سالن‌ها", icon: Landmark, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER", "CUSTODIAN"], tint: 3, group: "services" },
  { href: "/app/dormitory", label: "خوابگاه", tKey: "nav.dormitory", short: "خوابگاه", icon: Building2, roles: ["*"], tint: 3, group: "services" },
  { href: "/app/mcp", label: "سرور MCP", tKey: "nav.mcp", short: "MCP", icon: Terminal, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER"], tint: 0, group: "admin" },
  { href: "/app/accessibility", label: "دسترس‌پذیری", tKey: "nav.accessibility", short: "دسترس‌پذیری", icon: Accessibility, roles: ["*"], tint: 1, group: "personal" },
  { href: "/app/countries", label: "بسته‌های کشور", tKey: "nav.countries", short: "کشورها", icon: Globe, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 2, group: "admin" },
  { href: "/app/languages", label: "زبان‌ها و پوشش ترجمه", tKey: "nav.languages", short: "زبان‌ها", icon: Globe, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 3, group: "admin" },
  { href: "/app/labs", label: "آزمایشگاه‌ها", tKey: "nav.labs", short: "آزمایشگاه", icon: FlaskConical, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 0, group: "admin" },
  { href: "/app/tracks", label: "مسیرهای تخصصی", tKey: "nav.tracks", short: "مسیرها", icon: GraduationCap, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "TEACHER"], tint: 1, group: "education" },
  { href: "/app/plugins", label: "افزونه‌ها", tKey: "nav.plugins", short: "افزونه", icon: Puzzle, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 2, group: "admin" },
  { href: "/app/engagement", label: "نظرسنجی و پیشنهاد", tKey: "nav.engagement", short: "نظرسنجی", icon: Vote, roles: ["*"], tint: 3, group: "comms" },
  { href: "/app/certificates", label: "گواهی‌ها", tKey: "nav.certificates", short: "گواهی‌ها", icon: ScrollText, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 0, group: "students" },
  { href: "/app/reports", label: "گزارش‌ها و داده", tKey: "nav.reports", short: "گزارش‌ها", icon: FileBarChart, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 1, group: "admin" },
  { href: "/app/imports", label: "ایمپورت و اکسپورت", tKey: "nav.importExport", short: "ایمپورت", icon: FileUp, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"], tint: 3, group: "admin" },
  { href: "/app/finance", label: "امور مالی", tKey: "nav.finance", short: "مالی", icon: Wallet, roles: ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN", "STUDENT", "PARENT"], tint: 2, group: "finance" },
  { href: "/app/meetings", label: "ملاقات‌ها", tKey: "nav.meetings", short: "ملاقات", icon: Handshake, roles: ["*"], tint: 3, group: "comms" },
  { href: "/app/leaves", label: "مرخصی‌ها", tKey: "nav.leaves", short: "مرخصی", icon: CalendarOff, roles: ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN", "CUSTODIAN"], tint: 0, group: "admin" },
  { href: "/app/events", label: "رویدادها", tKey: "nav.events", short: "رویدادها", icon: Sparkles, roles: ["*"], tint: 1, group: "comms" },
  { href: "/app/announcements", label: "اعلان‌ها", tKey: "nav.announcements", short: "اعلان‌ها", icon: BellRing, roles: ["*"], tint: 2, group: "comms" },
  { href: "/app/leads", label: "پیش‌ثبت‌نام‌ها", tKey: "nav.leads", short: "پیش‌ثبت‌نام", icon: CheckCheck, roles: ["MANAGER", "DEPUTY"], tint: 3, group: "students" },
  { href: "/app/admissions", label: "قیف پذیرش", tKey: "nav.admissions", short: "پذیرش", icon: UserPlus, roles: ["MANAGER", "DEPUTY"], tint: 1, group: "students" },
  { href: "/app/preschool", label: "پیش‌دبستانی", tKey: "nav.preschool", short: "پیش‌دبستانی", icon: Baby, roles: ["*"], tint: 2, group: "students" },
  { href: "/app/health", label: "سلامت جسمانی و درمانگاه", tKey: "nav.health", short: "سلامت", icon: HeartPulse, roles: ["*"], tint: 3, group: "students" },
  { href: "/app/lesson-plans", label: "طرح درس", tKey: "nav.lessonPlans", short: "طرح درس", icon: NotebookPen, roles: ["TEACHER", "MANAGER", "DEPUTY"], tint: 1, group: "education" },
  { href: "/app/network", label: "داشبورد شبکه", tKey: "nav.network", short: "شبکه", icon: Network, roles: ["SUPER_ADMIN", "ADMIN"], tint: 0, group: "admin" },
  { href: "/app/locale-settings", label: "پروفایل کشور", tKey: "nav.localeSettings", short: "کشور", icon: Globe, roles: ["MANAGER", "SUPER_ADMIN", "ADMIN"], tint: 2, group: "admin" },
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
