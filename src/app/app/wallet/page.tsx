"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet as WalletIcon, Loader2, PlusCircle, ShoppingBasket } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Tx = { id: string; kind: string; amount: number; note: string | null; createdAt: string };
type WalletData = { wallet: { studentId: string; balance: number; dailyLimit: number | null } | null; txs: Tx[] };
type ClassRow = { id: string; name: string; academicYear: string };
type StudentRow = { id: string; name: string };
type Me = { user: { role: string } };
type ShopProduct = { id: string; name: string; category: string; price: number; stock: number; allergens: string | null; isActive: boolean };
type ShopSale = { id: string; total: number; createdAt: string; items: Array<{ name: string; price: number; qty: number }> };
type ShopData = { products: ShopProduct[]; sales: ShopSale[] };

const KIND_TKEY: Record<string, string> = { TOPUP: "enum.kindFa.TOPUP", SPEND: "enum.kindFa.SPEND", REFUND: "enum.kindFa.REFUND" };

export default function WalletPage() {
  const { t } = useLang();
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
      toast.success(t("wallet.anjam-shd"));
      setAmount(""); setNote("");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  async function createProduct() {
    setBusy("product");
    try {
      await apiPost("/api/shop", { action: "createProduct", name: prodName, category: prodCat, price: Number(prodPrice) || 0, stock: Number(prodStock) || 0 });
      toast.success(t("wallet.kala-azafh-shd"));
      setProdName(""); setProdCat(""); setProdPrice(""); setProdStock("");
      refetchShop();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  async function sellProduct() {
    const targetStudent = isAudience ? data?.wallet?.studentId : studentId;
    if (!targetStudent || !sellProductId) return;
    setBusy("sell");
    try {
      const res = await apiPost<{ balance: number }>("/api/shop", { action: "sell", studentId: targetStudent, items: [{ productId: sellProductId, qty: Number(sellQty) || 1 }] });
      toast.success(`${t("wallet.frvsh-sbt-shd-mvjvdy-jdyd")} ${faNumber(res.balance)} ${t("wallet.tvman")}`);
      setSellQty("1");
      refetch(); refetchShop();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  const w = data?.wallet;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("wallet.bvfh-v-kyf-pvl-dansh-amvzy")} desc={t("wallet.bdvn-pvl-nqd-vly-sharzh-my-knd-v-sqf-my-gzard-bvfh-az-mvjvdy-brm")} />
      {!isAudience && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setStudentId(""); }}
              options={[{ value: "", label: t("wallet.antkhab-klas") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.student")}</span>
            <Select value={studentId} onChange={setStudentId}
              options={[{ value: "", label: t("wallet.antkhab-dansh-amvz") }, ...(roster?.students ?? []).map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("common.student")} /></label>
        </div>
      )}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {!isAudience && !studentId && <EmptyState icon={WalletIcon} title={t("wallet.dansh-amvzy-ra-antkhab-knyd")} />}

      {(isAudience || studentId) && data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={WalletIcon} label={t("wallet.mvjvdy-tvman")} value={w?.balance ?? 0} tone="spring" />
            <StatCard icon={ShoppingBasket} label={t("wallet.sqf-khrj-rvzanh")} value={w?.dailyLimit != null ? `${faNumber(w.dailyLimit)} ${t("wallet.tvman")}` : t("wallet.bdvn-sqf")} tone="soft" />
            <StatCard icon={PlusCircle} label={t("wallet.traknsh-ha")} value={data.txs.length} tone="ink" />
          </div>

          <div className="grid lg:grid-cols-2 gap-4 items-start">
            <div className="b-card p-6 flex flex-col gap-3">
              {(isParent || isStaff) && (
                <>
                  <b className="text-[14px]">{t("wallet.sharzh-kyf-pvl")}</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("wallet.mblgh-tvman")} />
                    <input className="b-input flex-1 min-w-36" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("wallet.tvzyh-akhtyary")} />
                    <button className="b-btn b-btn-buy" disabled={busy === "topup" || !amount} onClick={() => doAction("topup")}>
                      {busy === "topup" ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlusCircle className="w-4 h-4" />} {t("wallet.sharzh")}
                    </button>
                  </span>
                </>
              )}
              {isParent && (
                <>
                  <b className="text-[14px] mt-2">{t("wallet.sqf-khrj-rvzanh")}</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} placeholder={t("wallet.msla-50000")} />
                    <button className="b-btn b-btn-soft" disabled={busy === "setLimit"} onClick={() => doAction("setLimit", { dailyLimit: limit ? Number(limit) : null })}>{t("wallet.sbt-sqf")}</button>
                    <button className="b-btn b-btn-ghost" disabled={busy === "setLimit"} onClick={() => doAction("setLimit", { dailyLimit: null })}>{t("wallet.hzf-sqf")}</button>
                  </span>
                </>
              )}
              {isStaff && (
                <>
                  <b className="text-[14px] mt-2">{t("wallet.sbt-khryd-bvfh")}</b>
                  <span className="flex gap-2 flex-wrap">
                    <input className="b-input w-40" dir="ltr" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={t("wallet.mblgh-khryd")} />
                    <input className="b-input flex-1 min-w-36" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("wallet.chy-khryd-sandvych-abmyvh")} />
                    <button className="b-btn b-btn-spring" disabled={busy === "spend" || !amount} onClick={() => doAction("spend")}>
                      {busy === "spend" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} {t("wallet.ksr-az-kyf-pvl")}
                    </button>
                  </span>
                </>
              )}
              {role === "STUDENT" && <p className="text-[12px] text-steel">{t("wallet.sharzh-kyf-pvl-v-tayyn-sqf-rvzanh-ba-vly-shmast")}</p>}
            </div>

            <div className="b-card p-6 flex flex-col gap-1">
              <b className="text-[14px] mb-2">{t("wallet.ryz-traknsh-ha")}</b>
              {data.txs.length === 0 && <span className="text-[12px] text-steel">{t("wallet.traknshy-sbt-nshdh-ast")}</span>}
              {data.txs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span>{t(KIND_TKEY[tx.kind] ?? tx.kind)}{tx.note ? <span className="text-steel"> · {tx.note}</span> : ""}<span className="block text-[12px] text-steel">{formatDateFa(tx.createdAt)}</span></span>
                  <b className={tx.amount >= 0 ? "text-spring" : "text-blossom"} dir="ltr">{tx.amount >= 0 ? "+" : ""}{faNumber(tx.amount)}</b>
                </div>
              ))}
            </div>
          </div>
        <div className="b-card p-6 flex flex-col gap-4">
          <b className="text-[14px]">{t("wallet.frvshgah-bvfh")}</b>
          {!shop && <span className="text-[12px] text-steel">{t("wallet.dr-hal-bargzary-kalaha")}</span>}
          {shop && shop.products.length === 0 && <span className="text-[12px] text-steel">{t("wallet.hnvz-kalayy-sbt-nshdh-ast")}</span>}
          {shop && shop.products.length > 0 && (
            <div className="flex flex-col gap-1">
              {shop.products.map((pr) => (
                <div key={pr.id} className="flex items-center justify-between py-2 border-b border-hairline last:border-0 text-[14px]">
                  <span><b>{pr.name}</b>{pr.category ? <span className="text-steel"> · {pr.category}</span> : ""}{pr.allergens ? <span className="block text-[12px] text-blossom">{t("wallet.hsasyt")}: {pr.allergens}</span> : ""}{!pr.isActive && <span className="text-stone"> ({t("common.inactive")})</span>}</span>
                  <span className="flex items-center gap-3"><span className={pr.stock <= 5 ? "text-blossom font-bold" : ""}>{t("wallet.mvjvdy")}: {faNumber(pr.stock)}</span><b dir="ltr">{faNumber(pr.price)} {t("wallet.tvman")}</b></span>
                </div>
              ))}
            </div>
          )}
          {isStaff && (
            <>
              <b className="text-[14px] mt-1">{t("wallet.sbt-kalay-jdyd")}</b>
              <span className="flex gap-2 flex-wrap">
                <input className="b-input flex-1 min-w-36" value={prodName} onChange={(e) => setProdName(e.target.value)} placeholder={t("wallet.nam-kala")} />
                <input className="b-input w-32" value={prodCat} onChange={(e) => setProdCat(e.target.value)} placeholder={t("wallet.dsth-akhtyary")} />
                <input className="b-input w-32" dir="ltr" inputMode="numeric" value={prodPrice} onChange={(e) => setProdPrice(e.target.value)} placeholder={t("wallet.qymt-tvman")} />
                <input className="b-input w-28" dir="ltr" inputMode="numeric" value={prodStock} onChange={(e) => setProdStock(e.target.value)} placeholder={t("wallet.mvjvdy")} />
                <button className="b-btn b-btn-spring" disabled={busy === "product" || !prodName || !prodPrice} onClick={createProduct}>{t("wallet.afzvdn-kala")}</button>
              </span>
              <b className="text-[14px] mt-1">{t("wallet.frvsh-bh-dansh-amvz-antkhab-shdh")}</b>
              {!studentId && <span className="text-[12px] text-steel">{t("wallet.avl-az-balay-sfhh-dansh-amvz-ra-antkhab-knyd")}</span>}
              <span className="flex gap-2 flex-wrap">
                <Select value={sellProductId} onChange={setSellProductId}
                  options={[{ value: "", label: t("wallet.antkhab-kala") }, ...(shop?.products ?? []).filter((pr) => pr.isActive).map((pr) => ({ value: pr.id, label: `${pr.name} — ${faNumber(pr.price)} ${t("wallet.tvman-mvjvdy")} ${faNumber(pr.stock)})` }))]} placeholder={t("wallet.kala")} />
                <input className="b-input w-24" dir="ltr" inputMode="numeric" value={sellQty} onChange={(e) => setSellQty(e.target.value)} placeholder={t("wallet.tadad")} />
                <button className="b-btn b-btn-buy" disabled={busy === "sell" || !studentId || !sellProductId} onClick={sellProduct}>
                  {busy === "sell" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingBasket className="w-4 h-4" />} {t("wallet.sbt-frvsh-v-ksr-az-kyf-pvl")}
                </button>
              </span>
              {shop && shop.sales.length > 0 && (
                <div className="flex flex-col gap-1 mt-1">
                  <b className="text-[14px]">{t("wallet.frvsh-hay-akhyr")}</b>
                  {shop.sales.slice(0, 10).map((sa) => (
                    <div key={sa.id} className="text-[12px] text-steel py-1 border-b border-hairline last:border-0">
                      {sa.items.map((it) => `${it.name} ×${it.qty}`).join("، ")} — <b className="text-ink">{faNumber(sa.total)} {t("wallet.tvman")}</b> · {formatDateFa(sa.createdAt)}
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
