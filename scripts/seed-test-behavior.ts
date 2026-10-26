// seed one temporary behavior record to verify UI, then report id
import { db } from "../src/lib/db";

async function main() {
  const st = await db.student.findFirst({
    where: { status: "ACTIVE" },
    include: { user: { select: { id: true } }, class: { select: { id: true } } },
  });
  if (!st) { console.log("NO_STUDENT"); process.exit(1); }
  const rec = await db.behaviorRecord.create({
    data: {
      studentId: st.id,
      classId: st.class?.id ?? null,
      schoolId: st.schoolId,
      kind: "POSITIVE",
      reason: "HELPING_CLASS",
      points: 2,
      note: "ui-render-test",
      recordedById: st.user.id,
    },
  });
  console.log("CREATED:" + rec.id);
}
main();
