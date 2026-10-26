import { db } from "../src/lib/db";
async function main() {
  const c = {
    houses: await db.house.count(), tasks: await db.task.count(), polls: await db.poll.count(),
    rules: await db.automationRule.count(), rooms: await db.room.count(), assets: await db.asset.count(),
    notifs: await db.notification.count(), questions: await db.question.count(), homes: await db.student.count({ where: { houseId: { not: null } } }),
  };
  console.log(c);
}
main().finally(() => db.$disconnect());
