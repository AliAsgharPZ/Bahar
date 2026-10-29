import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generatePassword, isValidNationalId, isValidShadNumber } from "@/lib/auth";
import { requirePermission, requireUser, apiOk, apiErr, handleApiError, readJson, audit, requireSchoolId, isDemoUser, ApiError, demoWriteBlock} from "@/lib/api";
import { deliverCredentials } from "@/lib/shad";
import { enDigits } from "@/lib/persian";
import { avatarApiFields } from "@/lib/avatar";

type ParentInput = {
  nationalId?: string;
  firstName?: string;
  lastName?: string;
  relation?: string; // FATHER | MOTHER | GUARDIAN
  phone?: string;
  shadNumber?: string;
  jobTitle?: string;
  education?: string;
};

/** GET /api/students?classId=&q= */
export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const q = searchParams.get("q")?.trim();
    const schoolId = requireSchoolId(me);
    // دانش‌آموز/ولی فهرست نمی‌بیند
    if (me.role === "STUDENT" || me.role === "PARENT") {
      return apiErr(403, "برای شما تعریف نشده است.", "FORBIDDEN");
    }

    const where: Record<string, unknown> = { schoolId };
    if (classId) where.classId = classId;
    if (q) {
      where.OR = [
        { user: { firstName: { contains: q } } },
        { user: { lastName: { contains: q } } },
        { user: { nationalId: { contains: q } } },
        { studentNumber: { contains: q } },
      ];
    }

    const students = await db.student.findMany({
      where,
      include: {
        user: {
          select: { id: true, nationalId: true, firstName: true, lastName: true, fatherName: true, gender: true, birthDate: true, shadNumber: true, phone: true, isActive: true, mustChangePassword: true, profileImageType: true, photoUrl: true, avatarConfig: true },
        },
        class: { select: { id: true, name: true, grade: true, field: true } },
        parents: {
          include: {
            parentUser: { select: { id: true, nationalId: true, firstName: true, lastName: true, phone: true, shadNumber: true, jobTitle: true, isActive: true, profileImageType: true, photoUrl: true, avatarConfig: true } },
          },
        },
      },
      orderBy: [{ class: { name: "asc" } }, { user: { lastName: "asc" } }],
      take: 500,
    });

    return apiOk({
      students: students.map((s) => ({
        ...s,
        user: { ...s.user, ...avatarApiFields(s.user) },
        parents: s.parents.map((p) => ({ ...p, parentUser: { ...p.parentUser, ...avatarApiFields(p.parentUser) } })),
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

/** POST /api/students — دانش‌آموز + پروفایل + اولیا (رمز تصادفی برای همه) */
export async function POST(req: NextRequest) {
  try {
    const me = await requirePermission(req, "manage_students");
    if (await isDemoUser(me)) return apiErr(403, "این قابلیت در حساب دمو غیرفعال است.", "DEMO_READONLY");
    const schoolId = requireSchoolId(me);
    const school = await db.school.findUnique({ where: { id: schoolId } });
    if (!school) return apiErr(404, "مدرسه یافت نشد.", "NOT_FOUND");

    const body = await readJson<Record<string, string | ParentInput[] | undefined>>(req);
    const nationalId = enDigits(String(body.nationalId ?? "")).trim();
    if (!isValidNationalId(nationalId)) return apiErr(400, "کد ملی دانش‌آموز نامعتبر است.", "BAD_NATIONAL_ID");
    const exists = await db.user.findUnique({ where: { nationalId } });
    if (exists) return apiErr(409, "این کد ملی قبلاً ثبت شده است.", "DUPLICATE");

    const firstName = String(body.firstName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    if (firstName.length < 2 || lastName.length < 2) {
      return apiErr(400, "نام و نام خانوادگی دانش‌آموز الزامی است.", "BAD_NAME");
    }

    const classId = body.classId ? String(body.classId) : null;
    let studentNumber = String(body.studentNumber ?? "").trim();
    if (!studentNumber) {
      // تولید خودکار شماره دانش‌آموزی
      const count = await db.student.count({ where: { schoolId } });
      studentNumber = String(1000 + count + 1);
    }
    const dupeNumber = await db.student.findFirst({ where: { schoolId, studentNumber } });
    if (dupeNumber) return apiErr(409, "شماره دانش‌آموزی تکراری است.", "DUPLICATE");

    if (classId) {
      const cls = await db.class.findUnique({ where: { id: classId } });
      if (!cls || cls.schoolId !== schoolId) return apiErr(400, "کلاس نامعتبر است.", "BAD_CLASS");
      const inClass = await db.student.count({ where: { classId } });
      if (cls.capacity && inClass >= cls.capacity) {
        return apiErr(400, "ظرفیت این کلاس تکمیل است.", "CLASS_FULL");
      }
    }

    const shadNumber = body.shadNumber ? enDigits(String(body.shadNumber)).trim() : null;
    if (shadNumber && !isValidShadNumber(shadNumber)) {
      return apiErr(400, "شماره شاد دانش‌آموز نامعتبر است.", "BAD_SHAD");
    }

    // ── رمز تصادفی دانش‌آموز ──
    const password = generatePassword();

    // ── پردازش اولیا ──
    const parentsInput: ParentInput[] = Array.isArray(body.parents) ? (body.parents as ParentInput[]) : [];
    const parentsResult: Array<{
      id: string; nationalId: string; firstName: string; lastName: string;
      relation: string; password?: string; isNew: boolean; shadDelivery?: { ok: boolean; error?: string };
    }> = [];
    const parentLinks: Array<{ parentUserId: string; relation: string; isPrimary: boolean }> = [];

    for (const p of parentsInput) {
      const pNational = enDigits(String(p.nationalId ?? "")).trim();
      if (!isValidNationalId(pNational)) {
        return apiErr(400, `کد ملی ولی (${pNational || "—"}) نامعتبر است.`, "BAD_NATIONAL_ID");
      }
      const relation = ["FATHER", "MOTHER", "GUARDIAN"].includes(String(p.relation)) ? String(p.relation) : "FATHER";
      const pShad = p.shadNumber ? enDigits(String(p.shadNumber)).trim() : null;

      let parentUser = await db.user.findUnique({ where: { nationalId: pNational } });
      let pPassword: string | undefined;

      if (parentUser) {
        if (parentUser.role !== "PARENT") {
          return apiErr(409, `کد ملی ${pNational} برای نقش دیگری ثبت شده است.`, "ROLE_CONFLICT");
        }
        // به‌روزرسانی اطلاعات تماس در صورت خالی بودن
        // FIX (راند ۱۶): والدِ مدرسه دیگر به مدرسه جاری منتقل نمی‌شود
        const patch: Record<string, unknown> = {};
        if (!parentUser.schoolId) patch.schoolId = schoolId;
        if (!parentUser.shadNumber && pShad) patch.shadNumber = pShad;
        if (!parentUser.phone && p.phone) patch.phone = enDigits(String(p.phone));
        if (p.jobTitle && !parentUser.jobTitle) patch.jobTitle = String(p.jobTitle);
        await db.user.update({ where: { id: parentUser.id }, data: patch });
        parentsResult.push({
          id: parentUser.id, nationalId: pNational,
          firstName: parentUser.firstName, lastName: parentUser.lastName,
          relation, isNew: false,
        });
      } else {
        const pFirst = String(p.firstName ?? "").trim();
        const pLast = String(p.lastName ?? "").trim();
        if (pFirst.length < 2 || pLast.length < 2) {
          return apiErr(400, "نام و نام خانوادگی ولی الزامی است.", "BAD_PARENT_NAME");
        }
        pPassword = generatePassword();
        parentUser = await db.user.create({
          data: {
            nationalId: pNational,
            passwordHash: hashPassword(pPassword),
            tempPassword: pPassword,
            mustChangePassword: true,
            role: "PARENT",
            firstName: pFirst,
            lastName: pLast,
            phone: p.phone ? enDigits(String(p.phone)).trim() : null,
            shadNumber: pShad,
            jobTitle: p.jobTitle ? String(p.jobTitle) : null,
            education: p.education ? String(p.education) : null,
            schoolId,
            createdBy: me.id,
          },
        });
        parentsResult.push({
          id: parentUser.id, nationalId: pNational,
          firstName: pFirst, lastName: pLast,
          relation, password: pPassword, isNew: true,
        });
      }
      parentLinks.push({
        parentUserId: parentUser.id,
        relation,
        isPrimary: relation === "FATHER" || relation === "MOTHER",
      });
    }

    // ── ساخت دانش‌آموز — کاربر + پرونده + پیوندها در یک batch تراکنش ──
    // (قبلاً IIFE بود: خرابیِ student.create کاربر یتیم می‌ساخت)
    const studentUserId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const autoNumber = !String(body.studentNumber ?? "").trim();
    const studentData = {
      nationalId,
      passwordHash: hashPassword(password),
      tempPassword: password,
      mustChangePassword: true,
      role: "STUDENT",
      firstName,
      lastName,
      fatherName: body.fatherName ? String(body.fatherName) : null,
      gender: body.gender ? String(body.gender) : null,
      birthDate: (() => {
        if (!body.birthDate) return null;
        const d = new Date(String(body.birthDate));
        if (isNaN(d.getTime())) throw new ApiError(400, "BAD_DATE", "تاریخ تولد نامعتبر است.");
        return d;
      })(),
      birthPlace: body.birthPlace ? String(body.birthPlace) : null,
      phone: body.phone ? enDigits(String(body.phone)).trim() : null,
      shadNumber,
      address: body.address ? String(body.address) : null,
      schoolId,
      createdBy: me.id,
    };
    let student: { id: string; userId: string } | null = null;
    // شمارهٔ خودکار در رقابت هم‌زمان ممکن است تکراری شود — batch اتمی است پس تلاش مجدد بی‌خطر است
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const [, createdStudent] = await db.$transaction([
          db.user.create({ data: { id: studentUserId, ...studentData } }),
          db.student.create({
            data: {
              id: studentId,
              userId: studentUserId,
              schoolId,
              classId,
              studentNumber,
              entryYear: body.entryYear ? String(body.entryYear) : null,
              previousSchool: body.previousSchool ? String(body.previousSchool) : null,
              healthNotes: body.healthNotes ? String(body.healthNotes) : null,
              parents: { create: parentLinks },
            },
          }),
        ]);
        student = createdStudent;
        break;
      } catch (e) {
        const uniqueClash = e instanceof Error && e.message.includes("Unique constraint");
        if (autoNumber && uniqueClash && attempt < 3) {
          const count = await db.student.count({ where: { schoolId } });
          studentNumber = String(1000 + count + 1);
          continue;
        }
        throw e;
      }
    }
    // جبران ظرفیت (الگوی خوابگاه): ساخت هم‌زمان ممکن است کلاس را پر کرده باشد
    if (classId) {
      const clsNow = await db.class.findUnique({ where: { id: classId }, select: { capacity: true } });
      if (clsNow?.capacity) {
        const inClassNow = await db.student.count({ where: { classId } });
        if (inClassNow > clsNow.capacity) {
          await db.$transaction([
            db.student.delete({ where: { id: student!.id } }),
            db.user.delete({ where: { id: student!.userId } }),
          ]);
          return apiErr(400, "ظرفیت این کلاس تکمیل است.", "CLASS_FULL");
        }
      }
    }

    if (!student) throw new Error("STUDENT_CREATE_FAILED");
    // ── ارسال اعتبارنامه با شاد (راند ۱۸: فقط وقتی شاد مدرسه روشن باشد) ──
    const shadOn = school?.shadEnabled !== false;
    let shadDelivery: { ok: boolean; error?: string } = { ok: false, error: shadOn ? "NO_SHAD_NUMBER" : "SHAD_DISABLED" };
    if (shadNumber && shadOn) {
      shadDelivery = await deliverCredentials(
        { id: student.userId, nationalId, firstName, lastName, role: "STUDENT", schoolId, shadNumber, tempPassword: password },
        school.name,
        "دانش‌آموز"
      );
    }
    for (let i = 0; i < parentsResult.length; i++) {
      const pr = parentsResult[i];
      const pInput = parentsInput[i];
      if (pr.isNew && pr.password && pInput.shadNumber && shadOn) {
        pr.shadDelivery = await deliverCredentials(
          { id: pr.id, nationalId: pr.nationalId, firstName: pr.firstName, lastName: pr.lastName, role: "PARENT", shadNumber: enDigits(String(pInput.shadNumber)).trim(), tempPassword: pr.password, schoolId },
          school.name,
          "ولی دانش‌آموز"
        );
      }
    }

    await audit({
      user: me, action: "CREATE_STUDENT", entityType: "STUDENT", entityId: student.id,
      meta: { nationalId, studentNumber, parents: parentsResult.map((p) => p.nationalId) },
      schoolId,
    });

    return apiOk({
      student: { id: student.id, studentNumber, userId: student.userId },
      user: { id: student.userId, nationalId, firstName, lastName },
      password,
      parents: parentsResult,
      shadDelivery,
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const me = await requireUser(req, ["MANAGER", "DEPUTY", "SUPER_ADMIN", "ADMIN"]);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!id) return apiErr(400, "شناسه لازم است.", "NO_ID");
    const row = await db.student.findUnique({ where: { id }, select: { schoolId: true } });
    if (!row) return apiErr(404, "یافت نشد.", "NOT_FOUND");
    if (me.schoolId && row.schoolId !== me.schoolId) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    
    await db.student.delete({ where: { id } });
    return apiOk({ ok: true });
  } catch (e) { return handleApiError(e); }
}
