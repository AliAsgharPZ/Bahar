// استخراج نقش‌ها و کاربران از دیتابیس
import { PrismaClient } from '../src/generated/prisma/client';

const prisma = new PrismaClient();

function maskPass(hash: string | null | undefined) {
  if (!hash) return 'NULL';
  if (hash.startsWith('$2')) return 'bcrypt';
  if (hash === 'demo1234') return 'PLAIN:demo1234';
  return `${hash.substring(0, 8)}...`;
}

async function main() {
  const roles = await prisma.user.groupBy({
    by: ['role'],
    _count: { role: true },
  });
  console.log('=== نقش‌ها ===');
  roles.forEach(r => console.log(`${r.role}: ${r._count.role} کاربر`));

  console.log('\n=== نمونه کاربران هر نقش (فعال) ===');
  for (const r of roles) {
    const users = await prisma.user.findMany({
      where: { role: r.role, isActive: true },
      take: 3,
      orderBy: { nationalId: 'asc' },
      select: {
        nationalId: true,
        firstName: true,
        lastName: true,
        role: true,
        schoolId: true,
        passwordHash: true,
        tempPassword: true,
        mustChangePassword: true,
      },
    });
    console.log(`\n--- ${r.role} ---`);
    users.forEach(u => {
      console.log(`  ${u.nationalId} | ${u.firstName} ${u.lastName} | school=${u.schoolId} | hash=${maskPass(u.passwordHash)} | tempPass=${u.tempPassword ?? '-'} | mustChange=${u.mustChangePassword}`);
    });
  }

  // بررسی منطق لاگین برای فهم فرمت پسورد
  console.log('\n=== بررسی پسورد کاربران شناخته‌شده ===');
  const known = await prisma.user.findMany({
    where: { nationalId: { in: ['2000000010'] } },
    select: { nationalId: true, role: true, passwordHash: true, tempPassword: true },
  });
  known.forEach(u => console.log(JSON.stringify({ ...u, passwordHash: maskPass(u.passwordHash) })));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
