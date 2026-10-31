/**
 * چیدمان صندلی امتحان — منطق خالص و قطعی (بدون دیتابیس) تا قابل آزمون باشد.
 * اتاق‌ها به ترتیب پر می‌شوند؛ داخل هر اتاق صندلی‌ها ردیف‌به‌ردیف شماره می‌گیرند.
 * میز دونفره یعنی هر جایگاه میز دو صندلی دارد (ستون‌های مؤثر دو برابر).
 */

export type SeatRoom = { name: string; rows: number; cols: number; deskType: "SINGLE" | "DOUBLE" };
export type SeatStudent = { id: string; name: string; classId: string; className: string };
export type SeatAssignmentOut = { studentId: string; sessionNo: number; roomName: string; seatNo: number; rowNo: number; colNo: number };
export type SeatStrategy = "BY_CLASS" | "MIXED";
export type SeatSessionMode = "ALL_EACH" | "SPLIT";

export function roomCapacity(room: SeatRoom): number {
  const per = room.deskType === "DOUBLE" ? 2 : 1;
  return Math.max(0, room.rows) * Math.max(0, room.cols) * per;
}

export function totalCapacity(rooms: SeatRoom[]): number {
  return rooms.reduce((s, r) => s + roomCapacity(r), 0);
}

function byName(a: SeatStudent, b: SeatStudent): number {
  return a.name.localeCompare(b.name, "fa");
}

/** ترتیب دانش‌آموزان: بر اساس کلاس، یا یکی‌درمیان از کلاس‌های مختلف (ضد تقلب) */
export function orderStudents(students: SeatStudent[], classOrder: string[], strategy: SeatStrategy): SeatStudent[] {
  const groups = new Map<string, SeatStudent[]>();
  for (const cid of classOrder) groups.set(cid, []);
  for (const s of students) {
    if (!groups.has(s.classId)) groups.set(s.classId, []);
    groups.get(s.classId)!.push(s);
  }
  for (const g of groups.values()) g.sort(byName);
  const orderedGroups = classOrder.map((cid) => groups.get(cid)!).filter((g) => g.length);
  if (strategy === "BY_CLASS") return orderedGroups.flat();
  // MIXED: چرخشی از هر کلاس یکی
  const out: SeatStudent[] = [];
  const queues = orderedGroups.map((g) => [...g]);
  let added = true;
  while (added) {
    added = false;
    for (const q of queues) {
      const next = q.shift();
      if (next) { out.push(next); added = true; }
    }
  }
  return out;
}

/** نشاندن یک فهرست مرتب روی اتاق‌ها؛ اگر ظرفیت کم است null برمی‌گردد */
export function seatIntoRooms(ordered: SeatStudent[], rooms: SeatRoom[], sessionNo: number, rotateBy = 0): SeatAssignmentOut[] | null {
  if (ordered.length > totalCapacity(rooms)) return null;
  const list = rotateBy > 0 && ordered.length > 1
    ? [...ordered.slice(rotateBy % ordered.length), ...ordered.slice(0, rotateBy % ordered.length)]
    : ordered;
  const out: SeatAssignmentOut[] = [];
  let idx = 0;
  for (const room of rooms) {
    const per = room.deskType === "DOUBLE" ? 2 : 1;
    const effCols = room.cols * per;
    const cap = roomCapacity(room);
    for (let seat = 1; seat <= cap && idx < list.length; seat++, idx++) {
      const pos = seat - 1;
      out.push({
        studentId: list[idx].id,
        sessionNo,
        roomName: room.name,
        seatNo: seat,
        rowNo: Math.floor(pos / effCols) + 1,
        colNo: (pos % effCols) + 1,
      });
    }
    if (idx >= list.length) break;
  }
  return out;
}

/** ساخت تخصیص همه نوبت‌ها بر اساس حالت نوبت */
export function buildAssignments(
  students: SeatStudent[],
  classOrder: string[],
  rooms: SeatRoom[],
  sessions: number,
  strategy: SeatStrategy,
  sessionMode: SeatSessionMode,
): SeatAssignmentOut[] | null {
  const ordered = orderStudents(students, classOrder, strategy);
  const all: SeatAssignmentOut[] = [];
  if (sessionMode === "ALL_EACH") {
    // همه در همه نوبت‌ها؛ هر نوبت چیدمان با یک شیفت می‌چرخد تا هم‌نشین‌ها عوض شوند
    for (let s = 1; s <= sessions; s++) {
      const part = seatIntoRooms(ordered, rooms, s, s - 1 === 0 ? 0 : Math.max(1, Math.floor(ordered.length / sessions)) * (s - 1));
      if (!part) return null;
      all.push(...part);
    }
    return all;
  }
  // SPLIT: دانش‌آموزان بین نوبت‌ها تقسیم می‌شوند؛ هر کس فقط یک نوبت
  const perSession = Math.ceil(ordered.length / sessions);
  for (let s = 1; s <= sessions; s++) {
    const chunk = ordered.slice((s - 1) * perSession, s * perSession);
    if (!chunk.length) continue;
    const part = seatIntoRooms(chunk, rooms, s, 0);
    if (!part) return null;
    all.push(...part);
  }
  return all;
}
