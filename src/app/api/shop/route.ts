import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireUser, apiOk, apiErr, handleApiError, readJson, actingSchoolIdFor } from "@/lib/api";
import type { SessionUser } from "@/lib/api";

/* ============================================================
   بهار | فروشگاه بوفه — کالا، موجودی و فروش متصل به کیف پول
   - کادر: تعریف کالا، تغییر قیمت/موجودی/فعال‌بودن، فروش
   - دانش‌آموز/ولی: فقط دیدن کالاهای فعال مدرسهٔ خود
   - فروش: بررسی موجودی + موجودی کیف پول + سقف روزانهٔ ولی،
     بعد در یک تراکنش: کم‌شدن موجودی، کم‌شدن کیف پول،
     ثبت WalletTx از جنس SPEND و ثبت فروش با اقلامش.
   - برگشت کالا (refund) عمداً اینجا نیست: برگشت از مسیر
     موجود کیف پول انجام می‌شود تا دو مسیر برگشت ساخته نشود.
   ============================================================ */

const STAFF = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"];

async function schoolIdFor(me: SessionUser, req: NextRequest) {
  if (me.role === "SUPER_ADMIN" || me.role === "ADMIN") return actingSchoolIdFor(req, me) ?? me.schoolId ?? null;
  return me.schoolId ?? actingSchoolIdFor(req, me) ?? null;
}

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
    const isStaff = STAFF.includes(me.role);
    const schoolId = await schoolIdFor(me, req);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    const products = await db.shopProduct.findMany({
      where: { schoolId, ...(isStaff ? {} : { isActive: true }) },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    if (!isStaff) return apiOk({ products, sales: [] });
    const sales = await db.shopSale.findMany({
      where: { schoolId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return apiOk({ products, sales });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const me = await requireUser(req);
    const body = await readJson<{
      action?: string; id?: string; name?: string; category?: string; price?: number;
      stock?: number; allergens?: string | null; isActive?: boolean;
      studentId?: string; items?: Array<{ productId?: string; qty?: number }>;
    }>(req);
    const schoolId = await schoolIdFor(me, req);
    if (!schoolId) return apiErr(400, "کاربر به مدرسه‌ای متصل نیست.", "NO_SCHOOL");
    if (!STAFF.includes(me.role)) return apiErr(403, "دسترسی ندارید.", "FORBIDDEN");

    if (body.action === "createProduct") {
      const name = String(body.name ?? "").trim();
      const price = Math.round(Number(body.price ?? 0));
      const stock = Math.max(0, Math.round(Number(body.stock ?? 0)));
      if (!name || name.length > 120) return apiErr(400, "نام کالا نامعتبر است.", "BAD_NAME");
      if (price <= 0 || price > 50_000_000) return apiErr(400, "قیمت کالا نامعتبر است.", "BAD_PRICE");
      const product = await db.shopProduct.create({
        data: { schoolId, name, category: String(body.category ?? "").trim().slice(0, 60), price, stock, allergens: body.allergens?.trim().slice(0, 200) || null },
      });
      return apiOk({ product });
    }

    if (body.action === "updateProduct") {
      const product = await db.shopProduct.findFirst({ where: { id: String(body.id ?? ""), schoolId } });
      if (!product) return apiErr(404, "کالا یافت نشد.", "NOT_FOUND");
      const data: Record<string, unknown> = {};
      if (body.name !== undefined) {
        const name = String(body.name).trim();
        if (!name || name.length > 120) return apiErr(400, "نام کالا نامعتبر است.", "BAD_NAME");
        data.name = name;
      }
      if (body.category !== undefined) data.category = String(body.category).trim().slice(0, 60);
      if (body.price !== undefined) {
        const price = Math.round(Number(body.price));
        if (price <= 0 || price > 50_000_000) return apiErr(400, "قیمت کالا نامعتبر است.", "BAD_PRICE");
        data.price = price;
      }
      if (body.stock !== undefined) data.stock = Math.max(0, Math.round(Number(body.stock)));
      if (body.allergens !== undefined) data.allergens = body.allergens?.trim().slice(0, 200) || null;
      if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
      const updated = await db.shopProduct.update({ where: { id: product.id }, data });
      return apiOk({ product: updated });
    }

    if (body.action === "sell") {
      const studentId = String(body.studentId ?? "");
      const st = await db.student.findFirst({ where: { id: studentId, schoolId }, select: { id: true, schoolId: true } });
      if (!st) return apiErr(404, "دانش‌آموز یافت نشد.", "NOT_FOUND");
      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0 || rawItems.length > 20) return apiErr(400, "اقلام فروش نامعتبر است.", "BAD_ITEMS");
      // ادغام کالاهای تکراری در یک فاکتور
      const merged = new Map<string, number>();
      for (const it of rawItems) {
        const qty = Math.round(Number(it.qty ?? 0));
        if (!it.productId || qty <= 0 || qty > 100) return apiErr(400, "تعداد کالا نامعتبر است.", "BAD_QTY");
        merged.set(String(it.productId), (merged.get(String(it.productId)) ?? 0) + qty);
      }
      const products = await db.shopProduct.findMany({ where: { id: { in: [...merged.keys()] }, schoolId } });
      if (products.length !== merged.size) return apiErr(404, "یک کالا یافت نشد.", "NOT_FOUND");
      const lines = products.map((p) => ({ product: p, qty: merged.get(p.id)!, lineTotal: p.price * merged.get(p.id)! }));
      const inactive = lines.find((l) => !l.product.isActive);
      if (inactive) return apiErr(409, "یک کالا غیرفعال است.", "INACTIVE");
      const outOfStock = lines.find((l) => l.product.stock < l.qty);
      if (outOfStock) return apiErr(409, "موجودی یک کالا کافی نیست.", "NO_STOCK");
      const total = lines.reduce((s, l) => s + l.lineTotal, 0);
      if (total <= 0) return apiErr(400, "مبلغ فروش نامعتبر است.", "BAD_TOTAL");

      const wallet = await db.studentWallet.findUnique({ where: { studentId } });
      if (!wallet || wallet.balance < total) return apiErr(409, "موجودی کیف پول کافی نیست.", "NO_BALANCE");
      if (wallet.dailyLimit != null) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const spentToday = await db.walletTx.aggregate({
          where: { walletId: wallet.id, kind: "SPEND", createdAt: { gte: today } },
          _sum: { amount: true },
        });
        if (Math.abs(spentToday._sum.amount ?? 0) + total > wallet.dailyLimit) {
          return apiErr(409, "از سقف خرج روزانهٔ ولی بیشتر می‌شود.", "OVER_LIMIT");
        }
      }

      try {
        const result = await db.$transaction(async (tx) => {
          for (const l of lines) {
            const updated = await tx.shopProduct.updateMany({
              where: { id: l.product.id, stock: { gte: l.qty } },
              data: { stock: { decrement: l.qty } },
            });
            if (updated.count !== 1) throw new Error("NO_STOCK");
          }
          const updatedWallet = await tx.studentWallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: total } },
          });
          const note = lines.map((l) => `${l.product.name} ×${l.qty}`).join("، ").slice(0, 200);
          const txRow = await tx.walletTx.create({
            data: { walletId: wallet.id, kind: "SPEND", amount: -total, note: `خرید بوفه: ${note}`, createdById: me.id },
          });
          const sale = await tx.shopSale.create({
            data: {
              schoolId, studentId, total, walletTxId: txRow.id, createdById: me.id,
              items: { create: lines.map((l) => ({ productId: l.product.id, name: l.product.name, price: l.product.price, qty: l.qty })) },
            },
            include: { items: true },
          });
          return { sale, balance: updatedWallet.balance };
        });
        return apiOk(result);
      } catch (e) {
        if (e instanceof Error && e.message === "NO_STOCK") {
          return apiErr(409, "موجودی یک کالا کافی نیست.", "NO_STOCK");
        }
        throw e;
      }
    }

    return apiErr(400, "عملیات نامعتبر.", "BAD_ACTION");
  } catch (e) {
    return handleApiError(e);
  }
}
