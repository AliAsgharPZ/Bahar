// تست لاگین هر ۷ نقش از طریق API واقعی
const BASE = 'http://localhost:3000';
const accounts = [
  { nationalId: '1000000011', role: 'SUPER_ADMIN' },
  { nationalId: '1000000028', role: 'ADMIN' },
  { nationalId: '2000000010', role: 'MANAGER' },
  { nationalId: '2000000029', role: 'DEPUTY' },
  { nationalId: '3000000011', role: 'TEACHER' },
  { nationalId: '6000000014', role: 'PARENT' },
  { nationalId: '5000000013', role: 'STUDENT' },
];

async function main() {
  let ok = 0;
  for (const acc of accounts) {
    try {
      const res = await fetch(`${BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nationalId: acc.nationalId, password: 'demo1234' }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body?.user) {
        console.log(`✓ ${acc.role.padEnd(11)} ${acc.nationalId} → OK (name=${body.user.firstName ?? '-'} redirect=${body.redirectTo ?? body.user.role ?? '-'})`);
        ok++;
      } else {
        console.log(`✗ ${acc.role.padEnd(11)} ${acc.nationalId} → HTTP ${res.status}: ${JSON.stringify(body).substring(0, 120)}`);
      }
    } catch (e: any) {
      console.log(`✗ ${acc.role.padEnd(11)} ${acc.nationalId} → خطا: ${e.message}`);
    }
  }
  console.log(`\nنتیجه: ${ok}/${accounts.length} موفق`);
}

main();
