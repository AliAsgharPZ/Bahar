// پاک‌سازی ردپای تست‌های اسکریپتی
import { PrismaClient } from '../src/generated/prisma-node/client';

const prisma = new PrismaClient();

async function main() {
  // حذف LoginEvent های ایجادشده توسط تست‌های bun/fetch امروزی
  const deleted = await prisma.loginEvent.deleteMany({
    where: {
      OR: [
        { userAgent: { contains: 'Bun' } },
        { userAgent: { contains: 'bun' } },
        { userAgent: '' },
      ],
    },
  });
  console.log(`LoginEvent های تستی حذف‌شده: ${deleted.count}`);

  // نمایش ۵ رویداد اخیر برای کنترل
  const recent = await prisma.loginEvent.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, userAgent: true, status: true },
  });
  console.log('۵ رویداد اخیر باقی‌مانده:');
  recent.forEach(e => console.log(`  ${e.createdAt.toISOString()} status=${e.status} ua=${(e.userAgent ?? '-').substring(0, 40)}`));
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
