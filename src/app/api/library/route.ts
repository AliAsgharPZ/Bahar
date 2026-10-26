import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, audit, demoWriteBlock, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | کتابخانهٔ مدرسه — کاتالوگ کتاب + امانت به دانش‌آموز
   GET  /api/library?q=        کاتالوگ + امانت‌های فعال + امانت‌های من
   POST /api/library           action: createBook | updateBook |
                               deleteBook | loan | return
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "TEACHER", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const isStaff = STAFF.includes(me.role);
    const now = new Date();

    const books = await db.book.findMany({
      where: {
        schoolId,
        ...(q
          ? { OR: [{ title: { contains: q } }, { author: { contains: q } }, { isbn: { contains: q } }, { category: { contains: q } }] }
          : {}),
      },
      orderBy: [{ title: "asc" }],
      take: 500,
      include: { loans: { where: { returnedAt: null }, select: { id: true } } },
    });

    const bookRows = books.map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      category: b.category,
      shelf: b.shelf,
      totalCopies: b.totalCopies,
      loanedCount: b.loans.length,
      available: Math.max(0, b.totalCopies - b.loans.length),
    }));

    let activeLoans: unknown[] = [];
    let overdueCount = 0;
    if (isStaff) {
      const loans = await db.bookLoan.findMany({
        where: { schoolId, returnedAt: null },
        orderBy: { dueAt: "asc" },
        take: 300,
        include: {
          book: { select: { title: true } },
          student: { select: { id: true, class: { select: { name: true } }, user: { select: { firstName: true, lastName: true } } } },
        },
      });
      overdueCount = loans.filter((l) => l.dueAt < now).length;
      activeLoans = loans.map((l) => ({
        id: l.id,
        bookId: l.bookId,
        bookTitle: l.book.title,
        studentId: l.studentId,
        studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
        className: l.student.class?.name ?? "—",
        loanedAt: l.loanedAt,
        dueAt: l.dueAt,
        overdue: l.dueAt < now,
      }));
    }

    // امانت‌های خودم (دانش‌آموز) یا فرزندانم (ولی)
    let myLoans: unknown[] = [];
    if (me.role === "STUDENT" || me.role === "PARENT") {
      let studentIds: string[] = [];
      if (me.role === "STUDENT") {
        const own = await db.student.findFirst({ where: { userId: me.id }, select: { id: true } });
        studentIds = own ? [own.id] : [];
      } else {
        const links = await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } });
        studentIds = links.map((x) => x.studentId);
      }
      if (studentIds.length) {
        const loans = await db.bookLoan.findMany({
          where: { studentId: { in: studentIds } },
          orderBy: [{ returnedAt: "asc" }, { dueAt: "asc" }],
          take: 100,
          include: {
            book: { select: { title: true, author: true } },
            student: { select: { user: { select: { firstName: true, lastName: true } } } },
          },
        });
        myLoans = loans.map((l) => ({
          id: l.id,
          bookTitle: l.book.title,
          bookAuthor: l.book.author,
          studentName: `${l.student.user.firstName} ${l.student.user.lastName}`,
          loanedAt: l.loanedAt,
          dueAt: l.dueAt,
          returnedAt: l.returnedAt,
          overdue: !l.returnedAt && l.dueAt < now,
        }));
      }
    }

    return apiOk({
      canManage: isStaff,
      books: bookRows,
      activeLoans,
      myLoans,
      stats: {
        titles: bookRows.length,
        copies: bookRows.reduce((s, b) => s + b.totalCopies, 0),
        activeLoans: isStaff ? activeLoans.length : myLoans.filter((l) => !(l as { returnedAt: unknown }).returnedAt).length,
        overdue: overdueCount,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const blocked = await demoWriteBlock(me);
    if (blocked) return blocked;
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
    const schoolId = me.schoolId ?? actingSchoolIdFor(req, me);
    if (!schoolId) return apiErr(400, "ابتدا وارد پنل یک مدرسه شوید.", "NO_SCHOOL");

    const body = await readJson<{
      action?: string;
      id?: string;
      title?: string;
      author?: string | null;
      isbn?: string | null;
      category?: string | null;
      shelf?: string | null;
      totalCopies?: number;
      bookId?: string;
      studentId?: string;
      dueDays?: number;
      loanId?: string;
    }>(req);
    const action = body.action ?? "";

    if (action === "createBook") {
      const title = String(body.title ?? "").trim().slice(0, 200);
      if (title.length < 2) return apiErr(400, "عنوان کتاب را وارد کنید.", "BAD_TITLE");
      const book = await db.book.create({
        data: {
          schoolId,
          title,
          author: body.author?.trim().slice(0, 120) || null,
          isbn: body.isbn?.trim().slice(0, 32) || null,
          category: body.category?.trim().slice(0, 80) || null,
          shelf: body.shelf?.trim().slice(0, 40) || null,
          totalCopies: Math.min(500, Math.max(1, Math.floor(Number(body.totalCopies) || 1))),
        },
      });
      await audit({ user: me, action: "افزودن کتاب", entityType: "Book", entityId: book.id, meta: { title } });
      return apiOk({ book });
    }

    if (action === "updateBook") {
      const book = await db.book.findFirst({ where: { id: body.id ?? "", schoolId } });
      if (!book) return apiErr(404, "کتاب یافت نشد.", "NOT_FOUND");
      const updated = await db.book.update({
        where: { id: book.id },
        data: {
          ...(body.title !== undefined ? { title: String(body.title).trim().slice(0, 200) || book.title } : {}),
          ...(body.author !== undefined ? { author: body.author?.trim().slice(0, 120) || null } : {}),
          ...(body.isbn !== undefined ? { isbn: body.isbn?.trim().slice(0, 32) || null } : {}),
          ...(body.category !== undefined ? { category: body.category?.trim().slice(0, 80) || null } : {}),
          ...(body.shelf !== undefined ? { shelf: body.shelf?.trim().slice(0, 40) || null } : {}),
          ...(body.totalCopies !== undefined ? { totalCopies: Math.min(500, Math.max(1, Math.floor(Number(body.totalCopies) || 1))) } : {}),
        },
      });
      await audit({ user: me, action: "ویرایش کتاب", entityType: "Book", entityId: book.id });
      return apiOk({ book: updated });
    }

    if (action === "deleteBook") {
      const book = await db.book.findFirst({ where: { id: body.id ?? "", schoolId } });
      if (!book) return apiErr(404, "کتاب یافت نشد.", "NOT_FOUND");
      const active = await db.bookLoan.count({ where: { bookId: book.id, returnedAt: null } });
      if (active > 0) return apiErr(400, "این کتاب نسخهٔ در امانت دارد و حذف نمی‌شود.", "HAS_ACTIVE_LOANS");
      await db.book.delete({ where: { id: book.id } });
      await audit({ user: me, action: "حذف کتاب", entityType: "Book", entityId: book.id });
      return apiOk({ ok: true });
    }

    if (action === "loan") {
      const book = await db.book.findFirst({ where: { id: body.bookId ?? "", schoolId } });
      if (!book) return apiErr(404, "کتاب یافت نشد.", "NOT_FOUND");
      const student = await db.student.findFirst({
        where: { id: body.studentId ?? "", schoolId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!student) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const [loanedCount, duplicate] = await Promise.all([
        db.bookLoan.count({ where: { bookId: book.id, returnedAt: null } }),
        db.bookLoan.findFirst({ where: { bookId: book.id, studentId: student.id, returnedAt: null }, select: { id: true } }),
      ]);
      if (duplicate) return apiErr(400, "این کتاب همین حالا دست همین دانش‌آموز است.", "DUPLICATE_LOAN");
      if (loanedCount >= book.totalCopies) return apiErr(400, "همهٔ نسخه‌های این کتاب در امانت است.", "NO_COPIES");
      const dueDays = Math.min(60, Math.max(1, Math.floor(Number(body.dueDays) || 14)));
      const loan = await db.bookLoan.create({
        data: {
          schoolId,
          bookId: book.id,
          studentId: student.id,
          dueAt: new Date(Date.now() + dueDays * 86400000),
          createdById: me.id,
        },
      });
      await audit({ user: me, action: "امانت کتاب", entityType: "BookLoan", entityId: loan.id, meta: { book: book.title } });
      return apiOk({ loan });
    }

    if (action === "return") {
      const loan = await db.bookLoan.findFirst({ where: { id: body.loanId ?? "", schoolId, returnedAt: null } });
      if (!loan) return apiErr(404, "امانت فعالی با این شناسه یافت نشد.", "NOT_FOUND");
      const updated = await db.bookLoan.update({ where: { id: loan.id }, data: { returnedAt: new Date() } });
      await audit({ user: me, action: "بازگشت کتاب", entityType: "BookLoan", entityId: loan.id });
      return apiOk({ loan: updated });
    }

    return apiErr(400, "action نامعتبر است.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
