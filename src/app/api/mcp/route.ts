import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser, type SessionUser } from "@/lib/api";

/* ============================================================
   بهار | سرور MCP — تا ایجنت‌ها با سامانه کار کنند
   پروتکل: JSON-RPC 2.0 روی همین مسیر (Streamable HTTP).
   احراز هویت: دقیقاً همان نشست کاربر (کوکی جلسه) و همان نقش‌ها
   و مجوزهای سامانه؛ هیچ توکن، کلید یا میان‌بر تازه‌ای ساخته
   نشده است. بدون نشست معتبر، همهٔ ابزارها 401 می‌دهند.
   ابزارهای خواندنی به مدرسهٔ کاربر محدودند؛ دانش‌آموز/ولی فقط
   دادهٔ خودش/فرزندانش را می‌بیند. ابزارهای نوشتنی فقط برای
   نقش‌های مجاز همان عملیات در سامانه است.
   ============================================================ */

const STAFF_WRITE = ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];
const ATTENDANCE_WRITE = ["TEACHER", "MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"];

type ToolDef = { name: string; description: string; inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] } };

const TOOLS: ToolDef[] = [
  { name: "mcp_list_schools", description: "List schools visible to the caller (service admins see all; school users see their own school).", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_list_students", description: "List students of the caller's school. Students/parents only see themselves/their children.", inputSchema: { type: "object", properties: { classId: { type: "string" }, limit: { type: "number" } } } },
  { name: "mcp_list_classes", description: "List classes of the caller's school.", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_get_attendance", description: "Attendance records for one student, optionally on one Jalali date (YYYY-MM-DD as stored).", inputSchema: { type: "object", properties: { studentId: { type: "string" }, date: { type: "string" } }, required: ["studentId"] } },
  { name: "mcp_list_grades", description: "Grade records for one student, optionally filtered by term (1 or 2).", inputSchema: { type: "object", properties: { studentId: { type: "string" }, term: { type: "number" } }, required: ["studentId"] } },
  { name: "mcp_get_wallet", description: "Student wallet balance and recent transactions.", inputSchema: { type: "object", properties: { studentId: { type: "string" } }, required: ["studentId"] } },
  { name: "mcp_list_dormitory_assignments", description: "Active dormitory assignments of the caller's school (or the caller's own).", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_list_shop_products", description: "Active buffet shop products of the caller's school.", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_list_announcements", description: "Recent school announcements for the caller's school.", inputSchema: { type: "object", properties: {} } },
  { name: "mcp_list_tasks", description: "Tasks of the caller's school, optionally filtered by status.", inputSchema: { type: "object", properties: { status: { type: "string" } } } },
  { name: "mcp_create_announcement", description: "Create a school announcement. Staff roles only.", inputSchema: { type: "object", properties: { title: { type: "string" }, body: { type: "string" }, classId: { type: "string" } }, required: ["title", "body"] } },
  { name: "mcp_create_task", description: "Create a school task. Staff roles only.", inputSchema: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, priority: { type: "string" }, studentId: { type: "string" } }, required: ["title"] } },
  { name: "mcp_record_attendance", description: "Record one attendance row. Teachers and school managers only.", inputSchema: { type: "object", properties: { studentId: { type: "string" }, classId: { type: "string" }, date: { type: "string" }, status: { type: "string" }, period: { type: "number" }, note: { type: "string" } }, required: ["studentId", "classId", "date", "status"] } },
];

function rpcError(id: unknown, code: number, message: string) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}
function rpcOk(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
}
function textResult(value: unknown) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }], structuredContent: value };
}

async function ownStudentIds(user: SessionUser): Promise<string[] | null> {
  if (user.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { userId: user.id }, select: { id: true } });
    return st ? [st.id] : [];
  }
  if (user.role === "PARENT") {
    return (await db.studentParent.findMany({ where: { parentUserId: user.id }, select: { studentId: true } })).map((l) => l.studentId);
  }
  return null; // staff/service: not restricted by ownership
}

async function scopedSchool(user: SessionUser, args: Record<string, unknown>): Promise<string> {
  if (user.schoolId) return user.schoolId;
  if ((user.role === "SUPER_ADMIN" || user.role === "ADMIN") && typeof args.schoolId === "string" && args.schoolId) {
    const school = await db.school.findUnique({ where: { id: args.schoolId }, select: { id: true, isActive: true } });
    if (school?.isActive) return school.id;
  }
  throw new Error("NO_SCHOOL");
}

async function checkStudentAccess(user: SessionUser, schoolId: string, studentId: string) {
  const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true } });
  if (!st) throw new Error("STUDENT_NOT_FOUND");
  const own = await ownStudentIds(user);
  if (own && !own.includes(studentId)) throw new Error("FORBIDDEN");
  return st;
}

async function callTool(user: SessionUser, name: string, args: Record<string, unknown>): Promise<unknown> {
  const schoolId = await scopedSchool(user, args);
  const own = await ownStudentIds(user);
  switch (name) {
    case "mcp_list_schools": {
      if (user.role === "SUPER_ADMIN" || user.role === "ADMIN") {
        return db.school.findMany({ select: { id: true, name: true, code: true, isActive: true }, orderBy: { name: "asc" }, take: 100 });
      }
      return db.school.findMany({ where: { id: schoolId }, select: { id: true, name: true, code: true, isActive: true } });
    }
    case "mcp_list_students": {
      const limit = Math.min(50, Math.max(1, Math.round(Number(args.limit ?? 20) || 20)));
      return db.student.findMany({
        where: { schoolId, status: "ACTIVE", ...(own ? { id: { in: own } } : {}), ...(typeof args.classId === "string" && args.classId ? { classId: args.classId } : {}) },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { createdAt: "desc" }, take: limit,
      }).then((rows) => rows.map((r) => ({ id: r.id, name: `${r.user.firstName} ${r.user.lastName}`, classId: r.classId, studentNumber: r.studentNumber, status: r.status })));
    }
    case "mcp_list_classes": {
      return db.class.findMany({ where: { schoolId }, select: { id: true, name: true, grade: true, academicYear: true }, orderBy: { name: "asc" }, take: 100 });
    }
    case "mcp_get_attendance": {
      const studentId = String(args.studentId ?? "");
      await checkStudentAccess(user, schoolId, studentId);
      return db.attendance.findMany({
        where: { studentId, ...(typeof args.date === "string" && args.date ? { date: args.date } : {}) },
        orderBy: { date: "desc" }, take: 50,
      });
    }
    case "mcp_list_grades": {
      const studentId = String(args.studentId ?? "");
      await checkStudentAccess(user, schoolId, studentId);
      return db.gradeRecord.findMany({
        where: { studentId, ...(typeof args.term === "number" ? { term: args.term } : {}) },
        orderBy: { createdAt: "desc" }, take: 100,
      });
    }
    case "mcp_get_wallet": {
      const studentId = String(args.studentId ?? "");
      await checkStudentAccess(user, schoolId, studentId);
      const wallet = await db.studentWallet.findUnique({ where: { studentId } });
      const txs = wallet ? await db.walletTx.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 20 }) : [];
      return { balance: wallet?.balance ?? 0, dailyLimit: wallet?.dailyLimit ?? null, txs };
    }
    case "mcp_list_dormitory_assignments": {
      return db.dormAssignment.findMany({
        where: { schoolId, status: "ACTIVE", ...(own ? { studentId: { in: own } } : {}) },
        include: { room: { include: { building: true } } }, orderBy: { createdAt: "desc" }, take: 100,
      }).then((rows) => rows.map((r) => ({ id: r.id, studentId: r.studentId, room: r.room.name, building: r.room.building.name, bedLabel: r.bedLabel, startDate: r.startDate })));
    }
    case "mcp_list_shop_products": {
      return db.shopProduct.findMany({ where: { schoolId, isActive: true }, orderBy: { name: "asc" }, take: 100 });
    }
    case "mcp_list_announcements": {
      return db.announcement.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, body: true, classId: true, pinned: true, createdAt: true } });
    }
    case "mcp_list_tasks": {
      return db.task.findMany({
        where: { schoolId, ...(typeof args.status === "string" && args.status ? { status: args.status } : {}) },
        orderBy: { createdAt: "desc" }, take: 50,
      });
    }
    case "mcp_create_announcement": {
      if (!STAFF_WRITE.includes(user.role)) throw new Error("FORBIDDEN");
      const title = String(args.title ?? "").trim();
      const bodyText = String(args.body ?? "").trim();
      if (!title || !bodyText) throw new Error("BAD_INPUT");
      if (typeof args.classId === "string" && args.classId) {
        const cls = await db.class.findFirst({ where: { id: args.classId, schoolId }, select: { id: true } });
        if (!cls) throw new Error("CLASS_NOT_FOUND");
      }
      return db.announcement.create({ data: { scope: "SCHOOL", schoolId, title, body: bodyText, classId: typeof args.classId === "string" && args.classId ? args.classId : null } });
    }
    case "mcp_create_task": {
      if (!STAFF_WRITE.includes(user.role)) throw new Error("FORBIDDEN");
      const title = String(args.title ?? "").trim();
      if (!title) throw new Error("BAD_INPUT");
      if (typeof args.studentId === "string" && args.studentId) await checkStudentAccess(user, schoolId, args.studentId);
      return db.task.create({
        data: { schoolId, title, description: typeof args.description === "string" ? args.description.slice(0, 1000) : null, priority: ["LOW", "NORMAL", "HIGH", "URGENT"].includes(String(args.priority)) ? String(args.priority) : "NORMAL", studentId: typeof args.studentId === "string" && args.studentId ? args.studentId : null, createdById: user.id },
      });
    }
    case "mcp_record_attendance": {
      if (!ATTENDANCE_WRITE.includes(user.role)) throw new Error("FORBIDDEN");
      const studentId = String(args.studentId ?? "");
      const classId = String(args.classId ?? "");
      const date = String(args.date ?? "");
      const status = String(args.status ?? "");
      if (!["PRESENT", "ABSENT", "LATE", "EXCUSED", "MISSION", "HALF_DAY"].includes(status)) throw new Error("BAD_STATUS");
      await checkStudentAccess(user, schoolId, studentId);
      const cls = await db.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } });
      if (!cls) throw new Error("CLASS_NOT_FOUND");
      return db.attendance.create({ data: { studentId, classId, date, status, period: Math.round(Number(args.period ?? 0) || 0), note: typeof args.note === "string" ? args.note.slice(0, 300) : null, recordedById: user.id } });
    }
    default:
      throw new Error("UNKNOWN_TOOL");
  }
}

export async function GET() {
  return NextResponse.json({
    name: "bahar-mcp", version: "1.0.0", protocol: "json-rpc-2.0",
    endpoint: "/api/mcp", auth: "same Bahar session cookie; no separate token",
    methods: ["initialize", "tools/list", "tools/call", "ping"],
    tools: TOOLS.map((t) => t.name),
  });
}

export async function POST(req: NextRequest) {
  let body: { jsonrpc?: string; id?: unknown; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } };
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  const { id = null, method = "" } = body;
  try {
    if (method === "initialize") {
      return rpcOk(id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "bahar-mcp", version: "1.0.0" } });
    }
    if (method === "notifications/initialized" || method.startsWith("notifications/")) {
      return new NextResponse(null, { status: 202 });
    }
    if (method === "ping") return rpcOk(id, {});
    // Every tool method requires a valid Bahar session — no bypass.
    const user = await getSessionUser(req);
    if (!user) return rpcError(id, -32001, "Unauthorized: a valid Bahar session is required");
    if (method === "tools/list") return rpcOk(id, { tools: TOOLS });
    if (method === "tools/call") {
      const name = body.params?.name ?? "";
      const args = body.params?.arguments ?? {};
      try {
        const value = await callTool(user, name, args);
        return rpcOk(id, textResult(value));
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Tool error";
        const code = msg === "FORBIDDEN" ? -32003 : msg === "NO_SCHOOL" ? -32002 : -32000;
        return rpcError(id, code, msg);
      }
    }
    return rpcError(id, -32601, "Method not found");
  } catch (e) {
    return rpcError(id, -32603, e instanceof Error ? e.message : "Internal error");
  }
}
