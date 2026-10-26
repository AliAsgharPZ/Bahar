// cleanup test artifacts from test-prod-fixes run
import { db } from "../src/lib/db";
import fs from "fs/promises";

async function main() {
  // 1. remove test upload file + audit rows
  const files = await fs.readdir("db/uploads").catch(() => [] as string[]);
  const testPngs = files.filter((f) => f.endsWith(".png") && f.includes("-"));
  for (const f of testPngs) {
    // only remove small test files (<2KB, our 95-byte PNG)
    const st = await fs.stat(`db/uploads/${f}`).catch(() => null);
    if (st && st.size < 2000) {
      await fs.unlink(`db/uploads/${f}`);
      console.log("removed upload:", f);
    }
  }
  // 2. purge test audit rows
  const a1 = await db.auditLog.deleteMany({ where: { action: "UPLOAD_MEDIA", entityId: { in: testPngs } } });
  const a2 = await db.auditLog.deleteMany({ where: { action: "UPDATE_SETTINGS", meta: { contains: "telegramBotToken" } } });
  console.log("audit rows removed:", a1.count + a2.count);
  // 3. any leftover synthetic user / announcement
  const u = await db.user.deleteMany({ where: { nationalId: "0012345679" } });
  const ann = await db.announcement.deleteMany({ where: { title: "x" } });
  console.log("users removed:", u.count, "announcements removed:", ann.count);
  // 4. verify settings token cleared
  const { getSettings } = await import("../src/lib/settings");
  const s = await getSettings();
  console.log("telegramBotToken now:", JSON.stringify(s.telegramBotToken), "enabled:", s.telegramBotEnabled);
  process.exit(0);
}
main();
