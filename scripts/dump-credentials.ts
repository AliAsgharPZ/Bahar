// استخراج کامل پسورد تمام اکانت‌ها با راستی‌آزمایی
import { PrismaClient } from '../src/generated/prisma/client';
import { scryptSync } from 'crypto';

const prisma = new PrismaClient();

function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':');
    const test = scryptSync(password, salt, 64).toString('hex');
    return scryptSync(password, salt, 64).toString('hex') === hash && test === hash;
  } catch {
    return false;
  }
}

async function main() {
  const schools = await prisma.school.findMany({ select: { id: true, name: true } });
  const schoolMap = new Map(schools.map(s => [s.id, s.name]));

  const users = await prisma.user.findMany({
    orderBy: [{ role: 'asc' }, { nationalId: 'asc' }],
    select: {
      nationalId: true, firstName: true, lastName: true, role: true,
      schoolId: true, tempPassword: true, passwordHash: true, mustChangePassword: true, isActive: true,
    },
  });

  const roleOrder = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'DEPUTY', 'TEACHER', 'PARENT', 'STUDENT'];
  const byRole: Record<string, typeof users> = {};
  for (const u of users) {
    (byRole[u.role] ??= []).push(u);
  }

  for (const role of roleOrder) {
    const list = byRole[role];
    if (!list) continue;
    console.log(`\n### ${role} (${list.length})`);
    for (const u of list) {
      const tp = u.tempPassword ?? '—';
      const valid = u.tempPassword ? verifyPassword(u.tempPassword, u.passwordHash) : false;
      const school = u.schoolId ? (schoolMap.get(u.schoolId) ?? '—') : 'سرویس';
      console.log(`${u.nationalId} | ${u.firstName} ${u.lastName} | ${school} | pass=${tp} | valid=${valid ? 'YES' : 'NO'} | mustChange=${u.mustChangePassword} | active=${u.isActive}`);
    }
  }
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
