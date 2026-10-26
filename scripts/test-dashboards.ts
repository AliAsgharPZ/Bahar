// تست داشبورد هر نقش با سشن واقعی (کوکی)
const BASE = 'http://localhost:3000';

async function login(nationalId: string) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nationalId, password: 'demo1234' }),
  });
  const cookie = res.headers.get('set-cookie')?.split(';')[0] ?? '';
  return { ok: res.ok, cookie };
}

async function main() {
  const accounts = [
    { nationalId: '1000000011', role: 'SUPER_ADMIN' },
    { nationalId: '1000000028', role: 'ADMIN' },
    { nationalId: '2000000010', role: 'MANAGER' },
    { nationalId: '2000000029', role: 'DEPUTY' },
    { nationalId: '3000000011', role: 'TEACHER' },
    { nationalId: '6000000014', role: 'PARENT' },
    { nationalId: '5000000013', role: 'STUDENT' },
  ];

  for (const acc of accounts) {
    const { ok, cookie } = await login(acc.nationalId);
    if (!ok) { console.log(`✗ ${acc.role}: لاگین شکست خورد`); continue; }
    // داشبورد API
    const dash = await fetch(`${BASE}/api/dashboard`, { headers: { cookie } });
    let dashInfo = `HTTP ${dash.status}`;
    if (dash.ok) {
      const d = await dash.json().catch(() => ({}));
      dashInfo = `OK scope=${d.scope ?? '-'}`;
    }
    // صفحه /app
    const page = await fetch(`${BASE}/app`, { headers: { cookie }, redirect: 'manual' });
    const pageStatus = page.status;
    const loc = page.headers.get('location') ?? '';
    console.log(`${pageStatus === 200 ? '✓' : '!'} ${acc.role.padEnd(11)} | dashboard: ${dashInfo} | صفحه /app: ${pageStatus}${loc ? ' → redirect: ' + loc : ''}`);
  }
}

main();
