// تنظیم اکانت‌های تست هر نقش با پسورد یکسان demo1234
import { PrismaClient } from '../src/generated/prisma-node/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// یک کاربر نماینده از هر نقش
const TEST_ACCOUNTS: Array<{ nationalId: string; role: string }> = [
  { nationalId: '1000000011', role: 'SUPER_ADMIN' },
  { nationalId: '1000000028', role: 'ADMIN' },
  { nationalId: '2000000010', role: 'MANAGER' },
  { nationalId: '2000000029', role: 'DEPUTY' },
  { nationalId: '3000000011', role: 'TEACHER' },
  { nationalId: '6000000014', role: 'PARENT' },
  { nationalId: '5000000013', role: 'STUDENT' },
];

async function main() {
  const hash = hashPassword('demo1234');

  for (const acc of TEST_ACCOUNTS) {
    const user = await prisma.user.findUnique({
      where: { nationalId: acc.nationalId },
      select: { id: true, nationalId: true, firstName: true, lastName: true, role: true, isActive: true },
    });
    if (!user) {
      console.log(`✗ ${acc.nationalId} (${acc.role}) پیدا نشد`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hash,
        tempPassword: 'demo1234',
        mustChangePassword: false,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
    console.log(`✓ ${user.role.padEnd(11)} | ${user.nationalId} | ${user.firstName} ${user.lastName}`);
  }

  // بکاپ قبل از تغییر — نه، تغییرات کوچک است. لیست نهایی:
  console.log('\n=== اکانت‌های تست نهایی ===');
  for (const acc of TEST_ACCOUNTS) {
    const u = await prisma.user.findUnique({
      where: { nationalId: acc.nationalId },
      select: { nationalId: true, firstName: true, lastName: true, role: true, mustChangePassword: true, isActive: true },
    });
    if (u) console.log(`${u.role.padEnd(11)} | ${u.nationalId} | ${u.firstName} ${u.lastName} | active=${u.isActive} | mustChange=${u.mustChangePassword}`);
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
