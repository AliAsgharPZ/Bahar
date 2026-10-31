/* ============================================================
   بهار | صورتجلسات — شورای معلمان، شورای مدرسه، انجمن اولیا و
   جلسات کارکنان: دستور جلسه، مصوبات و اقدام‌های پیگیری با
   مسئول و مهلت؛ اقدام‌های باز هر کاربر در مرکز اقدام‌ها هم
   دیده می‌شود.
   ============================================================ */

export const MINUTE_KINDS = [
  { key: "TEACHERS_COUNCIL", label: "شورای معلمان" },
  { key: "SCHOOL_COUNCIL", label: "شورای مدرسه" },
  { key: "PARENTS_ASSOC", label: "انجمن اولیا و مربیان" },
  { key: "STAFF", label: "جلسهٔ کارکنان" },
  { key: "OTHER", label: "سایر" },
] as const;

export type MinuteKind = (typeof MINUTE_KINDS)[number]["key"];

export function minuteKindLabel(key: string): string {
  return MINUTE_KINDS.find((k) => k.key === key)?.label ?? "جلسه";
}

export type MinuteAction = {
  id: string;
  text: string;
  ownerId: string | null;
  due: string | null; // YYYY-MM-DD
  done: boolean;
};

export function parseActions(json: string | null | undefined): MinuteAction[] {
  try {
    const arr = JSON.parse(json || "[]") as Array<Partial<MinuteAction>>;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((a) => a && typeof a.text === "string")
      .map((a, i) => ({
        id: String(a.id ?? `a${i}`),
        text: String(a.text).slice(0, 500),
        ownerId: a.ownerId ? String(a.ownerId) : null,
        due: a.due ? String(a.due).slice(0, 10) : null,
        done: a.done === true,
      }));
  } catch {
    return [];
  }
}

export function parseAttendees(json: string | null | undefined): string[] {
  try {
    const arr = JSON.parse(json || "[]") as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [];
  }
}

export function cleanActions(input: unknown): MinuteAction[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((a): a is Record<string, unknown> => !!a && typeof a === "object" && typeof (a as { text?: unknown }).text === "string" && String((a as { text?: unknown }).text).trim().length > 0)
    .slice(0, 50)
    .map((a, i) => ({
      id: `a${Date.now().toString(36)}${i}`,
      text: String(a.text).trim().slice(0, 500),
      ownerId: a.ownerId ? String(a.ownerId) : null,
      due: a.due ? String(a.due).slice(0, 10) : null,
      done: a.done === true,
    }));
}
