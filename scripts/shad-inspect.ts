// بهار | اسکریپت بازرسی شاد — خواندن وضعیت شاد از دیتابیس (فقط خواندن)
import { PrismaClient } from "../src/generated/prisma-node/client";
const db = new PrismaClient();

const mode = process.argv[2] ?? "overview";

async function main() {
  if (mode === "overview") {
    const schools = await db.school.findMany({
      select: { id: true, name: true, plan: true, shadEnabled: true, isActive: true },
    });
    console.log("== Schools ==");
    for (const s of schools) console.log(JSON.stringify(s));
    const users = await db.user.findMany({
      where: { role: { in: ["MANAGER", "TEACHER", "SUPER_ADMIN", "DEPUTY"] } },
      select: { id: true, nationalId: true, role: true, firstName: true, lastName: true, schoolId: true, isActive: true, mustChangePassword: true, shadNumber: true, tempPassword: true },
      take: 20,
    });
    console.log("== Users (manager/teacher/super/deputy) ==");
    for (const u of users) console.log(JSON.stringify(u));
    const sessions = await db.shadSession.findMany();
    console.log("== ShadSessions ==");
    for (const s of sessions) console.log(JSON.stringify({ ...s, authTokenEnc: s.authTokenEnc ? "<redacted>" : null }));
    const outbox = await db.shadOutbox.findMany({ orderBy: { createdAt: "desc" }, take: 15 });
    console.log("== ShadOutbox (last 15) ==");
    for (const o of outbox) console.log(JSON.stringify(o));
    const settingRow = await db.setting.findUnique({ where: { key: "system" } });
    console.log("== Settings row (shad/demo keys) ==");
    if (settingRow) {
      try {
        const s = JSON.parse(settingRow.value);
        console.log(JSON.stringify({
          shadGatewayUrl: s.shadGatewayUrl,
          demoEnabled: s.demoEnabled,
          demoManagerNationalId: s.demoManagerNationalId,
          demoStudentNationalId: s.demoStudentNationalId,
        }));
      } catch {
        console.log("(unparsable settings value)");
      }
    } else {
      console.log("(no settings row)");
    }
  } else if (mode === "set-shad") {
    // شبیه‌سازی سوئیچ مدرسه: bun scripts/shad-inspect.ts set-shad <schoolId> <on|off>
    const sid = process.argv[3];
    const on = process.argv[4] === "on";
    if (!sid) throw new Error("schoolId لازم است");
    await db.school.update({ where: { id: sid }, data: { shadEnabled: on } });
    const s = await db.school.findUnique({ where: { id: sid }, select: { id: true, shadEnabled: true } });
    console.log(JSON.stringify(s));
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
