/**
 * Bahar — Round 18 data fixes (idempotent, safe to re-run):
 *  1. Seed starter system badges (schoolId = null) so the badges page isn't empty.
 *  2. Create missing SchoolSite rows for every active school (lazy rows → no more
 *     surprise 404s; sites stay unpublished until the manager publishes).
 *  3. Delete leftover test user "تست موقت" / 0012345678 that pollutes search results.
 */
import { PrismaClient } from "../src/generated/prisma-node/client";

const db = new PrismaClient();

const STARTER_BADGES = [
  { key: "star-of-knowledge", title: "ستاره دانش", description: "معدل بالای ۱۹ در دو ترم پیاپی", icon: "Star", tier: "GOLD", points: 50, effectKind: "NONE" },
  { key: "attendance-hero", title: "قهرمان حضور", description: "یک ترم کامل بدون غیبت غیرموجه", icon: "CheckCircle2", tier: "SILVER", points: 30, effectKind: "NONE" },
  { key: "science-olympiad", title: "المپیاد علمی", description: "کسب رتبه در المپیادهای علمی کشوری", icon: "Trophy", tier: "DIAMOND", points: 100, effectKind: "NONE" },
  { key: "good-companion", title: "همدم خوب", description: "سه مورد تقدیر رفتاری مثبت از معاونین", icon: "HeartHandshake", tier: "BRONZE", points: 15, effectKind: "NONE" },
  { key: "reading-champion", title: "قهرمان مطالعه", description: "خواندن و ارائه ۱۰ کتاب در سال تحصیلی", icon: "BookOpen", tier: "BRONZE", points: 20, effectKind: "NONE" },
];

// بریدهٔ کوچک از slugify — فقط برای اسکریپت
function slugify(input: string): string {
  const map: Record<string, string> = {
    ا: "a", ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "ch", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z",
    ژ: "zh", س: "s", ش: "sh", ص: "s", ض: "z", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "gh", ک: "k", گ: "g",
    ل: "l", م: "m", ن: "n", و: "v", ه: "h", ی: "y", آ: "a", أ: "a", إ: "i", ئ: "y", ء: "", ة: "h",
    "ی": "y", "ک": "k",
  };
  const latin = input
    .split("")
    .map((ch) => (ch in map ? map[ch] : ch))
    .join("")
    .toLowerCase();
  const slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return slug;
}

async function main() {
  // ── 1) بج‌های سراسری پایدار ──
  let badgesCreated = 0;
  for (const b of STARTER_BADGES) {
    const existing = await db.badge.findFirst({ where: { key: b.key, schoolId: null } });
    if (!existing) {
      await db.badge.create({ data: { ...b, schoolId: null } });
      badgesCreated++;
    }
  }

  // ── 2) ردیف SchoolSite برای همه مدارس فعال ──
  const schools = await db.school.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } });
  let sitesCreated = 0;
  for (const s of schools) {
    const has = await db.schoolSite.findUnique({ where: { schoolId: s.id } });
    if (!has) {
      let sub = slugify(s.name);
      if (!sub || sub === "school") sub = `school-${s.code}`.slice(0, 40);
      const taken = await db.schoolSite.findUnique({ where: { subdomain: sub } });
      if (taken) sub = `${sub}-${s.code}`.slice(0, 40);
      await db.schoolSite.create({ data: { schoolId: s.id, subdomain: sub, templateId: "classic", published: false } });
      sitesCreated++;
    }
  }

  // ── 3) حذف کاربر آزمایشی جامانده ──
  const junk = await db.user.findFirst({ where: { nationalId: "0012345678" }, select: { id: true, firstName: true } });
  let junkDeleted = 0;
  if (junk) {
    // روابط احتمالی را پاک کن (نشست‌ها JWT بدون مدل DB هستند)
    await db.$transaction([
      db.message.deleteMany({ where: { OR: [{ fromUserId: junk.id }, { toUserId: junk.id }] } }),
      db.studentBadge.deleteMany({ where: { awardedById: junk.id } }),
      db.behaviorRecord.deleteMany({ where: { recordedById: junk.id } }),
      db.ticket.deleteMany({ where: { createdById: junk.id } }),
      db.ticketMessage.deleteMany({ where: { authorId: junk.id } }),
      db.student.deleteMany({ where: { userId: junk.id } }),
      db.user.delete({ where: { id: junk.id } }),
    ]).catch(async () => {
      // اگر تراکنش به‌خاطر رابطه‌ای دیگر شکست خورد، فقط غیرفعالش کن
      await db.user.update({ where: { id: junk.id }, data: { isActive: false } }).catch(() => {});
    });
    junkDeleted = 1;
  }

  console.log(JSON.stringify({
    schools: schools.length,
    badgesCreated,
    sitesCreated,
    junkDeleted,
  }, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
