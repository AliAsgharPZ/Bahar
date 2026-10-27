import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";

/* ============================================================
   بهار | بوفه و کیف پول دانش‌آموزی — ولی کیف پول را شارژ
   می‌کند و سقف خرج روزانه می‌گذارد؛ مسئول بوفه خرید را از
   موجودی کم می‌کند (با کنترل موجودی و سقف روزانه) و ولی
   ریز همهٔ تراکنش‌ها را می‌بیند. پول نقد از بوفه حذف می‌شود.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

async function myStudentIds(me: { id: string; role: string }): Promise<string[]> {
  if (me.role === "STUDENT") {
    const st = await db.student.findUnique({ where: { userId: me.id }, select: { id: true } });
    return st ? [st.id] : [];
  }
  if (me.role === "PARENT") {
    return (await db.studentParent.findMany({ where: { parentUserId: me.id }, select: { studentId: true } })).map((l) => l.studentId);
  }
  return [];
}

export async function GET(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const studentId = new URL(req.url).searchParams.get("studentId") ?? "";
    let target = studentId;
    if (me.role === "STUDENT" || me.role === "PARENT") {
      const mine = await myStudentIds(me);
      target = studentId && mine.includes(studentId) ? studentId : (mine[0] ?? "");
      if (!target) return apiOk({ wallet: null, txs: [] });
    } else {
      const schoolId = me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
      if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
      if (!target) return apiOk({ wallet: null, txs: [] });
      const st = await db.student.findFirst({ where: { id: target, schoolId }, select: { id: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    }
    const wallet = await db.studentWallet.findUnique({ where: { studentId: target } });
    if (!wallet) return apiOk({ wallet: { studentId: target, balance: 0, dailyLimit: null }, txs: [] });
    const txs = await db.walletTx.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return apiOk({ wallet, txs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{
      action?: string; studentId?: string; amount?: number; note?: string; dailyLimit?: number | null;
    }>(req);
    const studentId = String(body.studentId ?? "");
    const st = await db.student.findUnique({ where: { id: studentId }, select: { id: true, schoolId: true } });
    if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
    const amount = Math.round(Number(body.amount ?? 0));

    const ensureWallet = () =>
      db.studentWallet.upsert({
        where: { studentId },
        create: { schoolId: st.schoolId, studentId, balance: 0 },
        update: {},
      });

    if (body.action === "topup") {
      // ولی برای فرزند خودش؛ کادر برای دانش‌آموز مدرسه
      const mine = await myStudentIds(me);
      const allowed = mine.includes(studentId) || (STAFF.includes(me.role) && (!me.schoolId || me.schoolId === st.schoolId));
      if (!allowed) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");
      if (amount <= 0 || amount > 50_000_000) return apiErr(400, "مبلغ شارژ نامعتبر است.", "BAD_AMOUNT");
      const wallet = await ensureWallet();
      const updated = await db.studentWallet.update({ where: { id: wallet.id }, data: { balance: { increment: amount } } });
      await db.walletTx.create({ data: { walletId: wallet.id, kind: "TOPUP", amount, note: body.note?.trim().slice(0, 200) || "شارژ کیف پول", createdById: me.id } });
      return apiOk({ balance: updated.balance });
    }

    if (body.action === "setLimit") {
      const mine = await myStudentIds(me);
      if (!mine.includes(studentId)) return apiErr(403, "فقط ولی می‌تواند سقف روزانه بگذارد.", "FORBIDDEN");
      const wallet = await ensureWallet();
      await db.studentWallet.update({
        where: { id: wallet.id },
        data: { dailyLimit: body.dailyLimit == null ? null : Math.max(0, Math.round(body.dailyLimit)) },
      });
      return apiOk({ ok: true });
    }

    if (body.action === "spend") {
      await requireUser(req, STAFF);
      if (amount <= 0 || amount > 10_000_000) return apiErr(400, "مبلغ خرید نامعتبر است.", "BAD_AMOUNT");
      const wallet = await ensureWallet();
      if (wallet.balance < amount) return apiErr(409, "موجودی کیف پول کافی نیست.", "NO_BALANCE");
      if (wallet.dailyLimit != null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const spentToday = await db.walletTx.aggregate({
          where: { walletId: wallet.id, kind: "SPEND", createdAt: { gte: today } },
          _sum: { amount: true },
        });
        const spent = Math.abs(spentToday._sum.amount ?? 0);
        if (spent + amount > wallet.dailyLimit) return apiErr(409, "از سقف خرج روزانهٔ ولی بیشتر می‌شود.", "OVER_LIMIT");
      }
      const updated = await db.studentWallet.update({ where: { id: wallet.id }, data: { balance: { decrement: amount } } });
      await db.walletTx.create({ data: { walletId: wallet.id, kind: "SPEND", amount: -amount, note: body.note?.trim().slice(0, 200) || "خرید بوفه", createdById: me.id } });
      return apiOk({ balance: updated.balance });
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
