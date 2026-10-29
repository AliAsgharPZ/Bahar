import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, requirePermission, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser, demoWriteBlock } from "@/lib/api";
import { hasPermission } from "@/lib/roles";

/**
 * GET /api/grades?classId=&subjectId=&term=
 * GET /api/grades?studentId= — کارنامه دانش‌آموز (خودش/ولی/کارکنان)
 */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");

    // ── کارنامه شخصی ──
    if (studentId || me.role === "STUDENT" || me.role === "PARENT") {
      let targetId = studentId;
      if (me.role === "STUDENT") {
        const profile = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
        targetId = profile?.id ?? null;
      } else if (me.role === "PARENT") {
        if (studentId) {
          const link = await db.studentParent.findFirst({ where: { parentUserId: me.id, studentId } });
          if (!link) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
        } else {
          const children = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
          if (children.length === 0) return apiOk({ records: [] });
          const records = await db.gradeRecord.findMany({
            where: { studentId: { in: children.map((c) => c.studentId) } },
            include: {
              subject: { select: { name: true } },
              student: { include: { user: { select: { firstName: true, lastName: true } }, class: { select: { name: true } } } },
              enteredBy: { select: { firstName: true, lastName: true } },
            },
            orderBy: { createdAt: "desc" },
          });
          return apiOk({ records });
        }
      } else if (studentId) {
        // کارکنان: دانش‌آموز باید در همان مدرسه باشد
        const target = await db.student.findUnique({ where: { id: studentId }, select: { schoolId: true } });
        if (!target) return apiOk({ records: [] });
        if (me.role !== "SUPER_ADMIN" && me.role !== "ADMIN" && target.schoolId !== me.schoolId) {
          return apiErr(403, "این دانش‌آموز در مدرسه شما نیست.", "FORBIDDEN");
        }
      }
      if (!targetId) return apiOk({ records: [] });
      const records = await db.gradeRecord.findMany({
        where: { studentId: targetId },
        include: {
          subject: { select: { id: true, name: true } },
          enteredBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
      return apiOk({ records });
    }

    // ── دفتر نمرات کلاس ──
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId") ?? undefined;
    const term = searchParams.get("term") ?? undefined;
    if (!classId) return apiErr(400, "کلاس را مشخص کنید.", "BAD_INPUT");
    const schoolId = requireSchoolId(me);
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || (cls.schoolId !== schoolId && me.role !== "SUPER_ADMIN" && me.role !== "ADMIN")) {
      return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    }

    // معلم فقط درس‌های خودش
    let teacherFilter: string | string[] | undefined;
    if (me.role === "TEACHER") {
      const mine = await db.teachingAssignment.findMany({
        where: { teacherId: me.id, classId },
        select: { subjectId: true },
      });
      if (mine.length === 0) return apiErr(403, "شما در این کلاس درسی ندارید.", "FORBIDDEN");
      const allowed = mine.map((m) => m.subjectId);
      if (subjectId && !allowed.includes(subjectId)) {
        return apiErr(403, "این درس به شما تخصیص نیافته است.", "FORBIDDEN");
      }
      // FIX (راند ۱۶): بدون subjectId هم فقط درس‌های خودش — قبلاً همه درس‌های کلاس را می‌دید
      teacherFilter = subjectId ?? allowed;
    }

    const where: Record<string, unknown> = { classId };
    if (teacherFilter || subjectId) where.subjectId = teacherFilter ?? subjectId;
    if (term) where.term = Number(term);

    const [students, grades, history] = await Promise.all([
      db.student.findMany({
        where: { classId, user: { isActive: true } },
        include: { user: { select: { firstName: true, lastName: true } } },
        orderBy: { user: { lastName: "asc" } },
      }),
      db.gradeRecord.findMany({ where, include: { subject: { select: { name: true } } } }),
      // تاریخچهٔ آخرین تغییر هر نمره — برای Undo
      grades0History(where),
    ]);

    return apiOk({ students, grades, history, class: { id: cls.id, name: cls.name, grade: cls.grade } });
  } catch (e) {
    return handleApiError(e);
  }
}

/** آخرین رکورد تاریخچه برای هر نمره (برای دکمهٔ Undo) */
async function grades0History(where: Record<string, unknown>) {
  const recs = await db.gradeRecord.findMany({ where, select: { id: true } });
  if (recs.length === 0) return [];
  const hist = await db.gradeHistory.findMany({
    where: { gradeRecordId: { in: recs.map((r) => r.id) } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const lastByRecord = new Map<string, (typeof hist)[number]>();
  for (const h of hist) if (!lastByRecord.has(h.gradeRecordId)) lastByRecord.set(h.gradeRecordId, h);
  return Array.from(lastByRecord.values());
}

/** POST /api/grades — ثبت گروهی نمرات */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "enter_grades");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{
      classId?: string; subjectId?: string; term?: number;
      kind?: string;
      records?: Array<{ studentId?: string; score?: number; maxScore?: number; weight?: number; note?: string | null }>;
    }>(req);

    const classId = String(body.classId ?? "");
    const subjectId = String(body.subjectId ?? "");
    const term = Number(body.term ?? 1);
    const kind = String(body.kind ?? "QUIZ");
    if (!classId || !subjectId) return apiErr(400, "کلاس و درس الزامی است.", "BAD_INPUT");
    if (![1, 2].includes(term)) return apiErr(400, "نیمسال باید ۱ یا ۲ باشد.", "BAD_TERM");
    if (!["QUIZ", "MIDTERM", "FINAL", "PROJECT", "ACTIVITY", "BEHAVIOR"].includes(kind)) {
      return apiErr(400, "نوع نمره نامعتبر است.", "BAD_KIND");
    }

    const cls = await db.class.findUnique({ where: { id: classId } });
    const subject = await db.subject.findUnique({ where: { id: subjectId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    if (!subject || subject.schoolId !== schoolId) return apiErr(404, "درس یافت نشد.", "NOT_FOUND");

    if (me.role === "TEACHER") {
      const assigned = await db.teachingAssignment.findFirst({ where: { teacherId: me.id, classId, subjectId } });
      if (!assigned) return apiErr(403, "این درسِ این کلاس به شما تخصیص نیافته است.", "FORBIDDEN");
    }

    const records = Array.isArray(body.records) ? body.records.slice(0, 500) : [];
    const students = await db.student.findMany({ where: { classId }, select: { id: true, userId: true } });
    const studentIds = new Set(students.map((s) => s.id));

    let saved = 0;
    let skippedInvalid = 0;
    let skippedLocked = 0;
    let skippedStudent = 0;
    // FIX: اعتبارسنجی + خواندن رکوردهای قبلی بیرون، همهٔ نوشتن‌ها در یک batch —
    // خرابی وسط حلقه، رکوردهای قبلی را ذخیره‌شده و بعدی‌ها را گمشده نمی‌گذارد
    const ops: any[] = [];
    const drops: Array<{ studentId: string; drop: number }> = [];
    for (const r of records) {
      if (!r.studentId || !studentIds.has(r.studentId)) { skippedStudent++; continue; }
      const score = Number(r.score);
      const maxScore = Number(r.maxScore ?? 20);
      const weight = Number(r.weight ?? 1);
      if (!Number.isFinite(score) || score < 0 || !Number.isFinite(maxScore) || maxScore < 1 || maxScore > 200 || score > maxScore || !Number.isFinite(weight) || weight < 0 || weight > 20) { skippedInvalid++; continue; } // FIX راند ۱۶
      const data = {
        score, maxScore, weight: Number(r.weight ?? 1),
        note: r.note || null, enteredById: me.id,
      };
      const prev = await db.gradeRecord.findFirst({
        where: { studentId: r.studentId, classId, subjectId, term, kind },
        select: { id: true, score: true, note: true, locked: true },
      });
      if (prev) {
        // ── Grade Lock: نمره نهایی‌شده فقط با دسترسی unlock_grades ──
        if (prev.locked && me.role !== "MANAGER" && me.role !== "SUPER_ADMIN" && !me.permissions.includes("unlock_grades")) {
          skippedLocked++; continue; // نمره قفل است
        }
        saved++;
        ops.push(db.gradeRecord.update({ where: { id: prev.id }, data }));
        // ── تاریخچه تغییر نمره ──
        if (prev.score !== score) {
          ops.push(db.gradeHistory.create({
            data: { gradeRecordId: prev.id, studentId: r.studentId, oldScore: prev.score, newScore: score, oldNote: prev.note, newNote: r.note || null, changedById: me.id, source: "UPDATE" },
          }));
          const drop = prev.score - score;
          if (drop >= 4) drops.push({ studentId: r.studentId, drop });
        }
      } else {
        saved++;
        const newId = crypto.randomUUID();
        ops.push(db.gradeRecord.create({
          data: { id: newId, studentId: r.studentId, classId, subjectId, term, kind, ...data },
        }));
        ops.push(db.gradeHistory.create({
          data: { gradeRecordId: newId, studentId: r.studentId, oldScore: null, newScore: score, newNote: r.note || null, changedById: me.id, source: "CREATE" },
        }));
      }
    }
    if (ops.length) await db.$transaction(ops);
    // اتوماسیون افت نمره پس از batch (اثر جانبی، نه بخشی از تراکنش)
    for (const d of drops) {
      const su = await db.student.findUnique({ where: { id: d.studentId }, include: { user: true } });
      if (su) {
        import("@/lib/automation").then(({ runAutomations }) =>
          runAutomations({ type: "GRADE_DROP", schoolId, studentId: d.studentId, studentName: `${su.user.firstName} ${su.user.lastName}`, subjectName: subject.name, drop: d.drop })
        );
      }
    }

    await audit({
      user: me, action: "SAVE_GRADES", entityType: "CLASS", entityId: classId,
      meta: { subjectId, term, kind, saved, skippedInvalid, skippedLocked, skippedStudent }, schoolId,
    });
    return apiOk({ ok: true, saved, skippedInvalid, skippedLocked, skippedStudent, total: records.length });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PUT /api/grades — قفل/بازگشایی نمرات یک درس-کلاس (Grade Lock) */
export async function PUT(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "SUPER_ADMIN", "DEPUTY"]);
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ classId?: string; subjectId?: string; term?: number; locked?: boolean }>(req);
    // FIX (راند ۱۶): بازگشایی (unlock) نمره نیاز به دسترسی unlock_grades دارد
    // — قبلاً هر معاونی بدون دسترسی می‌توانست قفل را باز کند و نمره را ویرایش کند
    const willUnlock = body.locked === false;
    if (me.role === "DEPUTY" && willUnlock && !hasPermission(me, "unlock_grades")) {
      return apiErr(403, "بازگشایی نمرات نهایی نیاز به دسترسی «بازگشایی نمرات» دارد.", "FORBIDDEN");
    }
    const classId = String(body.classId ?? "");
    const subjectId = String(body.subjectId ?? "");
    const term = Number(body.term ?? 1);
    if (!classId || !subjectId) return apiErr(400, "کلاس و درس الزامی است.", "BAD_INPUT");
    const cls = await db.class.findUnique({ where: { id: classId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(404, "کلاس یافت نشد.", "NOT_FOUND");
    // درس باید متعلق به همان مدرسه باشد
    if (subjectId) {
      const subjOk = await db.subject.findFirst({ where: { id: subjectId, schoolId }, select: { id: true } });
      if (!subjOk) return apiErr(404, "درس یافت نشد.", "NOT_FOUND");
    }
    const locked = body.locked !== false;
    const res = await db.gradeRecord.updateMany({
      where: { classId, subjectId, term },
      data: { locked },
    });
    await audit({
      user: me, action: locked ? "GRADE_LOCK" : "GRADE_UNLOCK", entityType: "CLASS", entityId: classId,
      meta: { subjectId, term, count: res.count }, schoolId,
    });
    return apiOk({ ok: true, count: res.count, locked });
  } catch (e) {
    return handleApiError(e);
  }
}

/** PATCH /api/grades — Undo آخرین تغییر یک نمره (از روی GradeHistory) */
export async function PATCH(req: NextRequest) {
  try {
    const me = await requirePermission(req, "enter_grades");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const body = await readJson<{ historyId?: string }>(req);
    if (!body.historyId) return apiErr(400, "شناسه تاریخچه لازم است.", "BAD_INPUT");
    const h = await db.gradeHistory.findUnique({ where: { id: body.historyId } });
    if (!h) return apiErr(404, "رکورد تاریخچه یافت نشد.", "NOT_FOUND");
    const gr = await db.gradeRecord.findUnique({ where: { id: h.gradeRecordId } });
    if (!gr) return apiErr(404, "نمره یافت نشد.", "NOT_FOUND");
    const cls = await db.class.findUnique({ where: { id: gr.classId } });
    if (!cls || cls.schoolId !== schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    // معلم فقط تغییرات خودش را برمی‌گرداند؛ مدیر/ادمین همه را
    if (me.role === "TEACHER" && h.changedById !== me.id) {
      return apiErr(403, "فقط ثبت‌کننده تغییر یا مدیر می‌تواند آن را برگرداند.", "FORBIDDEN");
    }
    if (gr.locked && !["MANAGER", "SUPER_ADMIN"].includes(me.role) && !hasPermission(me, "unlock_grades")) {
      return apiErr(423, "این نمره نهایی شده است؛ ابتدا مدیر آن را بازگشایی کند.", "LOCKED");
    }
    if (h.newScore !== gr.score) {
      return apiErr(409, "این نمره پس از آن تغییر، دوباره ثبت شده است؛ Undo فقط آخرین تغییرِ معتبر است.", "CONFLICT");
    }
    await db.gradeRecord.update({
      where: { id: gr.id },
      data: { score: h.oldScore ?? gr.score, note: h.oldNote ?? gr.note },
    });
    await db.gradeHistory.create({
      data: { gradeRecordId: gr.id, studentId: gr.studentId, oldScore: gr.score, newScore: h.oldScore ?? gr.score, oldNote: gr.note, newNote: h.oldNote ?? null, changedById: me.id, source: "UNDO" },
    });
    await audit({ user: me, action: "UNDO_GRADE", entityType: "GradeRecord", entityId: gr.id, meta: { from: gr.score, to: h.oldScore }, schoolId });
    return apiOk({ ok: true, restored: h.oldScore });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.gradeRecord.findUnique({ where: { id }, select: { locked: true, student: { select: { schoolId: true } } } });
    if (!row) return apiErr(404, "نمره یافت نشد.", "NOT_FOUND");
    // FIX: قفل مثل PATCH undo اعمال می‌شود و میان‌برِ ثبت‌کننده حذف شد — فقط عضویت در مدرسه ملاک است
    if (row.locked && !["MANAGER", "SUPER_ADMIN"].includes(me.role) && !hasPermission(me, "unlock_grades")) {
      return apiErr(423, "این نمره نهایی شده است؛ ابتدا مدیر آن را بازگشایی کند.", "LOCKED");
    }
    const inSchool = me.schoolId && row.student.schoolId === me.schoolId;
    if (!inSchool && !["SUPER_ADMIN", "ADMIN"].includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    await db.gradeRecord.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
