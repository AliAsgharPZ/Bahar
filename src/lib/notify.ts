import { db } from "@/lib/db";

/** ایجاد اعلان برای یک کاربر (fire-and-forget) */
export async function notifyUser(
  userId: string,
  category: "URGENT" | "IMPORTANT" | "INFO" | "SUCCESS",
  title: string,
  body: string,
  link?: string,
  kind: string = "SYSTEM"
) {
  try {
    await db.notification.create({
      data: { userId, category, title, body, link: link ?? null, kind },
    });
  } catch (e) {
    console.error("[NOTIFY]", e);
  }
}

/** اعلان به چند کاربر */
export async function notifyMany(
  userIds: string[],
  category: "URGENT" | "IMPORTANT" | "INFO" | "SUCCESS",
  title: string,
  body: string,
  link?: string,
  kind: string = "SYSTEM"
) {
  if (!userIds.length) return;
  try {
    await db.notification.createMany({
      data: userIds.map((userId) => ({ userId, category, title, body, link: link ?? null, kind })),
    });
  } catch (e) {
    console.error("[NOTIFY]", e);
  }
}
