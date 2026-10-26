// اطلاعات مدارس + ساخت فایل متنی کامل اکانت‌ها
import { PrismaClient } from '../src/generated/prisma/client';
import { scryptSync } from 'crypto';
import { writeFileSync } from 'fs';

const prisma = new PrismaClient();

async function main() {
  const schools = await prisma.school.findMany({
    select: { id: true, name: true, code: true, type: true, plan: true, isActive: true },
  });
  const sites = await prisma.schoolSite.findMany({ select: { schoolId: true, subdomain: true, template: true } }).catch(() => []);
  const siteMap = new Map(sites.map((s: any) => [s.schoolId, s]));
  const schoolMap = new Map(schools.map(s => [s.id, s]));

  console.log('=== مدارس ===');
  for (const s of schools) {
    const site = siteMap.get(s.id);
    console.log(`${s.name} | code=${s.code} | plan=${s.plan} | subdomain=${site?.subdomain ?? '—'} | template=${site?.template ?? '—'}`);
  }

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { nationalId: 'asc' }],
    select: {
      nationalId: true, firstName: true, lastName: true, role: true,
      schoolId: true, tempPassword: true, mustChangePassword: true,
    },
  });

  const ROLE_FA: Record<string, string> = {
    SUPER_ADMIN: 'مدیر کل سرویس', ADMIN: 'ادمین سرویس', MANAGER: 'مدیر مدرسه',
    DEPUTY: 'معاون', TEACHER: 'معلم', PARENT: 'والد', STUDENT: 'دانش‌آموز',
  };
  const roleOrder = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DEPUTY', 'TEACHER', 'PARENT', 'STUDENT'];

  const lines: string[] = [];
  lines.push(' ╔══════════════════════════════════════════════════════════════╗');
  lines.push(' ║              بهار — اکانت‌های تست (دیتای دمو)               ║');
  lines.push(' ╚══════════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push('ورود: صفحه /login با «کد ملی» + «رمز عبور»');
  lines.push('⚠️ این اطلاعات فقط برای محیط دمو/تست است — قبل از استقرار واقعی، دیتای دمو را پاک کنید.');
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' ★ اکانت‌های اصلی تست — همه با رمز یکسان: demo1234 ★');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push('  کد ملی      | نقش            | نام');
  lines.push('  ----------- | -------------- | ------------------');
  const main7 = ['1000000011', '1000000028', '2000000010', '2000000029', '3000000011', '6000000014', '5000000013'];
  for (const nid of main7) {
    const u = users.find(x => x.nationalId === nid);
    if (u) lines.push(`  ${u.nationalId} | ${ROLE_FA[u.role].padEnd(14)} | ${u.firstName} ${u.lastName}`);
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' مدرسه دوم (برای تست چند-مدرسه‌ای):');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const secondSchool = schools.find(s => s.name.includes('نور'));
  const secondSchoolUsers = users.filter(u => u.schoolId === secondSchool?.id);
  for (const u of secondSchoolUsers) {
    lines.push(`  ${u.nationalId} | ${ROLE_FA[u.role].padEnd(14)} | ${u.firstName} ${u.lastName} | رمز: ${u.tempPassword ?? '—'}`);
  }
  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' لیست کامل تمام کاربران (۷۴ نفر) — گروه‌بندی بر اساس نقش');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  for (const role of roleOrder) {
    const list = users.filter(u => u.role === role);
    if (!list.length) continue;
    lines.push('');
    lines.push(`▌ ${ROLE_FA[role]} (${role}) — ${list.length} کاربر`);
    lines.push('  کد ملی      | نام                  | مدرسه                          | رمز عبور');
    lines.push('  ----------- | -------------------- | ------------------------------ | -----------');
    for (const u of list) {
      const school = u.schoolId ? (schoolMap.get(u.schoolId)?.shortName ?? schoolMap.get(u.schoolId)?.name ?? '—') : 'سطح سرویس';
      lines.push(`  ${u.nationalId} | ${(u.firstName + ' ' + u.lastName).padEnd(20)} | ${school.padEnd(30)} | ${u.tempPassword ?? '—'}`);
    }
  }

  lines.push('');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  lines.push(' مدارس دمو:');
  lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const s of schools) {
    const site = siteMap.get(s.id) as any;
    lines.push(`  • ${s.name} (کد: ${s.code}، پلن: ${s.plan})${site ? ` — سایت: /s/${site.subdomain} (قالب ${site.template})` : ''}`);
  }
  lines.push('');

  writeFileSync('bahar-test-accounts.txt', lines.join('\n'), 'utf-8');
  console.log('\n✓ فایل download/bahar-test-accounts.txt ساخته شد');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
