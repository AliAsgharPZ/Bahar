"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet as WalletIcon, Loader2, PlusCircle, ShoppingBasket } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Tx = { id: string; kind: string; amount: number; note: string | null; createdAt: string };
type WalletData = { wallet: { studentId: string; balance: number; dailyLimit: number | null } | null; txs: Tx[] };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };
type ShopProduct = { id: string; name: string; category: string; price: number; stock: number; allergens: string | null; isActive: boolean };
type ShopSale = { id: string; total: number; createdAt: string; items: Array<{ name: string; price: number; qty: number }> };
type ShopData = { products: ShopProduct[]; sales: ShopSale[] };

const KIND_FA: Record<string, string> = { TOPUP: "شارژ", SPEND: "خرید بوفه", REFUND: "برگشت" };

export default function WalletPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isAudience = role === "STUDENT" || role === "PARENT";
  const isParent = role === "PARENT";
  const isStaff = ["MANAGER", "DEPUTY", "CUSTODIAN", "SUPER_ADMIN", "ADMIN"].includes(role);
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(!isAudience ? "/api/classes" : null);
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const { data, loading, error, refetch } = useApi<WalletData>(
    isAudience ? `/api/wallet${studentId ? `?studentId=${studentId}` : ""}` : studentId ? `/api/wallet?studentId=${studentId}` : null,
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [limit, setLimit] = useState("");
  const [busy, setBusy] = useState("");
  const { data: shop, refetch: refetchShop } = useApi<ShopData>(isStaff || data ? "/api/shop" : null);
  const [prodName, setProdName] = useState("");
  const [prodCat, setProdCat] = useState("");
  const [prodPrice, setProdPrice] = useState("");
  const [prodStock, setProdStock] = useState("");
  const [sellProductId, setSellProductId] = useState("");
  const [sellQty, setSellQty] = useState("1");

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action);
    try {
      await apiPost("/api/wallet", { action, studentId: isAudience && !studentId ? data?.wallet?.studentId : studentId, amount: Number(amount) || 0, note, ...extra });
      toast.success("انجام شد.");
      setAmount(""); setNote("");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function createProduct() {
    setBusy("product");
    try {
      await apiPost("/api/shop", { action: "createProduct", name: prodName, category: prodCat, price: Number(prodPrice) || 0, stock: Number(prodStock) || 0 });
      toast.success("کالا اضافه شد.");
      setProdName(""); setProdCat(""); setProdPrice(""); setProdStock("");
      refetchShop();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  async function sellProduct() {
    const targetStudent = isAudience ? data?.wallet?.studentId : studentId;
    if (!targetStudent || !sellProductId) return;
    setBusy("sell");
    try {
      const res = await apiPost<{ balance: number }>("/api/shop", { action: "sell", studentId: targetStudent, items: [{ productId: sellProductId, qty: Number(sellQty) || 1 }] });
      toast.success(`فروش ثبت شد — موجودی جدید: ${faNumber(res.balance)} تومان`);
      setSellQty("1");
      refetch(); refetchShop();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(""); }
  }

  const w = data?.wallet;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="بوفه و کیف پول دانش‌آموزی" desc="بدون پول نقد: ولی شارژ می‌کند و سقف می‌گذارد، بوفه از موجودی برمی‌دارد، ریز خریدها شفاف است." />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="کلاس" /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">دانش‌آموز</span>
            <Select value={studentId} onChange={setStudentId}
              options={[{ value: "", label: "انتخاب دانش‌آموز" }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder="دانش‌آموز" /></label>
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {!isAudience && !studentId && <EmptyState icon={WalletIcon} title="دانش‌آموزی را انتخاب کنید" />}

      {(isAudience || studentId) && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={WalletIcon} label="موجودی (تومان)" value={w?.balance ?? 0} tone="spring" />
            <StatCard icon={ShoppingBasket} label="سقف خرج روزانه" value={w?.dailyLimit != null ? `${faNumber(w.dailyLimit)} تومان` : "بدون سقف"} tone="soft" />
            <StatCard icon={PlusCircle} label="تراکنش‌ها" value={data.txs.length} tone="ink" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              {(isParent || isStaff) && (
                <>
                  <b className="text-[14px]">شارژ کیف پول</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ (تومان)" />
                    <input className="b-input flex-1 min-w-36" value={note} onChange={(e) => setNote(e.target.value)} placeholder="توضیح (اختیاری)" />
                    <button className="b-btn b-btn-spring" disabled={busy === "topup" || !amount} onClick={() => doAction("topup")}>
                      {busy === "topup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} شارژ
                    </button>
                  </span>
                </>
              )}
              {isParent && (
                <>
                  <b className="text-[14px] mt-2">سقف خرج روزانه</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="مثلاً ۵۰۰۰۰" />
                    <button className="b-btn b-btn-soft" disabled={busy === "setLimit"} onClick={() => doAction("setLimit", { dailyLimit: limit ? Number(limit) : null })}>ثبت سقف</button>
                    <button className="b-btn b-btn-ghost" disabled={busy === "setLimit"} onClick={() => doAction("setLimit", { dailyLimit: null })}>حذف سقف</button>
                  </span>
                </>
              )}
              {isStaff && (
                <>
                  <b className="text-[14px] mt-2">ثبت خرید بوفه</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ خرید" />
                    <input className="b-input flex-1 min-w-36" value={note} onChange={(e) => setNote(e.target.value)} placeholder="چی خرید؟ (ساندویچ، آبمیوه…)" />
                    <button className="b-btn b-btn-spring" disabled={busy === "spend" || !amount} onClick={() => doAction("spend")}>
                      {busy === "spend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} کسر از کیف پول
                    </button>
                  </span>
                </>
              )}
              {role === "STUDENT" && <p className="text-[12.5px] text-steel">شارژ کیف پول و تعیین سقف روزانه با ولی شماست.</p>}
            </div>

            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">ریز تراکنش‌ها</b>
              {data.txs.length === 0 && <span className="text-[12.5px] text-steel">تراکنشی ثبت نشده است.</span>}
              {data.txs.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span>{KIND_FA[t.kind] ?? t.kind}{t.note ? <span className="text-steel"> · {t.note}</span> : ""}<span className="block text-[11px] text-steel">{formatDateFa(t.createdAt)}</span></span>
                  <b className={t.amount >= 0 ? "text-spring" : "text-blossom"} dir="ltr">{t.amount >= 0 ? "+" : ""}{faNumber(t.amount)}</b>
                </div>
              ))}
            </div>
          </div>
        <div className="b-card p-6 flex flex-col gap-4">
          <b className="text-[14px]">فروشگاه بوفه</b>
          {!shop && <span className="text-[12.5px] text-steel">در حال بارگذاری کالاها…</span>}
          {shop && shop.products.length === 0 && <span className="text-[12.5px] text-steel">هنوز کالایی ثبت نشده است.</span>}
          {shop && shop.products.length > 0 && (
            <div className="flex flex-col gap-1">
              {shop.products.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[13px]">
                  <span><b>{pr.name}</b>{pr.category ? <span className="text-steel"> · {pr.category}</span> : ""}{pr.allergens ? <span className="block text-[11px] text-blossom">حساسیت: {pr.allergens}</span> : ""}{!pr.isActive && <span className="text-stone"> (غیرفعال)</span>}</span>
                  <span className="flex items-center gap-3"><span className={pr.stock <= 5 ? "text-blossom font-bold" : ""}>موجودی: {faNumber(pr.stock)}</span><b dir="ltr">{faNumber(pr.price)} تومان</b></span>
                </div>
              ))}
            </div>
          )}
          {isStaff && (
            <>
              <b className="text-[14px] mt-1">ثبت کالای جدید</b>
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder="نام کالا" />
                <input className="b-input w-32" value={prodCat} onChange={(e) => setProdCat(e.target.value)} placeholder="دسته (اختیاری)" />
                <input className="b-input w-32" dir="ltr" inputMode="numeric" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder="قیمت (تومان)" />
                <input className="b-input w-28" dir="ltr" inputMode="numeric" value={prodStock} onChange={(e) => setProdStock(e.target.value)} placeholder="موجودی" />
                <button className="b-btn b-btn-spring" disabled={busy === "product" || !prodName || !prodPrice} onClick={createProduct}>افزودن کالا</button>
              </span>
              <b className="text-[14px] mt-1">فروش به دانش‌آموز انتخاب‌شده</b>
              {!studentId && <span className="text-[12.5px] text-steel">اول از بالای صفحه دانش‌آموز را انتخاب کنید.</span>}
              <span className="flex gap-2 flex-wrap">
                <Select value={sellProductId} onChange={setSellProductId}
                  options={[{ value: "", label: "انتخاب کالا" }, ...(shop?.products ?? []).filter((pr) => pr.isActive).map((pr) => ({ value: pr.id, label: `${pr.name} — ${faNumber(pr.price)} تومان (موجودی ${faNumber(pr.stock)})` }))]} placeholder="کالا" />
                <input className="b-input w-24" dir="ltr" inputMode="numeric" value={sellQty} onChange={(e) => setSellQty(e.target.value)} placeholder="تعداد" />
                <button className="b-btn b-btn-spring" disabled={busy === "sell" || !studentId || !sellProductId} onClick={sellProduct}>
                  {busy === "sell" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} ثبت فروش و کسر از کیف پول
                </button>
              </span>
              {shop && shop.sales.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <b className="text-[13px]">فروش‌های اخیر</b>
                  {shop.sales.slice(0, 10).map((sa) => (
                    <div key={sa.id} className="text-[12.5px] text-steel py-1 border-b border-hairline last:border-0">
                      {sa.items.map((it) => `${it.name} ×${it.qty}`).join("، ")} — <b className="text-ink">{faNumber(sa.total)} تومان</b> · {formatDateFa(sa.createdAt)}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        </>
      )}
    </div>
  );
}
