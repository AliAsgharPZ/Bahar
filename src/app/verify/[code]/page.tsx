"use client";

import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ShieldCheck, ShieldX, Sprout } from "lucide-react";
import { faNumber, formatDateFa } from "@/lib/persian";

type VerifyData = {
  valid: boolean;
  revoked?: boolean;
  message?: string;
  certificate?: { title: string; serial: string; issuedAt: string; school?: string; student?: string; class?: string | null };
};

export default function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [data, setData] = useState<VerifyData | null>(null);

  useEffect(() => {
    fetch(`/api/public/verify/${code}`).then((r) => r.json()).then(setData).catch(() => setData({ valid: false, message: "خطا در استعلام" }));
  }, [code]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="b-card-lg p-8 w-full max-w-md text-center">
        <Link href="/" className="inline-flex items-center gap-2 mb-6">
          <Sprout className="w-7 h-7 text-spring" />
          <span className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>بهار</span>
        </Link>
        {!data ? (
          <p className="t-body text-steel">در حال استعلام اصالت گواهی…</p>
        ) : data.valid ? (
          <>
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.15, type: "spring", stiffness: 500, damping: 22 }}
              className="w-20 h-20 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto mb-4">
              <ShieldCheck className="w-10 h-10" />
            </motion.span>
            <h1 className="t-h2 mb-1">گواهی معتبر است</h1>
            <p className="t-sm text-steel mb-6">اصالت این گواهی توسط سامانه بهار تأیید شد</p>
            {data.certificate && (
              <div className="b-card-sm p-4 text-start flex flex-col gap-2">
                <Row label="عنوان" value={data.certificate.title} />
                {data.certificate.student && <Row label="دانش‌آموز" value={data.certificate.student} />}
                {data.certificate.school && <Row label="مدرسه" value={data.certificate.school} />}
                <Row label="شماره سریال" value={data.certificate.serial} ltr />
                <Row label="تاریخ صدور" value={formatDateFa(data.certificate.issuedAt)} />
              </div>
            )}
          </>
        ) : (
          <>
            <span className="w-20 h-20 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
              <ShieldX className="w-10 h-10" />
            </span>
            <h1 className="t-h2 mb-1">{data.revoked ? "گواهی باطل شده است" : "گواهی یافت نشد"}</h1>
            <p className="t-sm text-steel">{data.message ?? "کد استعلام واردشده با هیچ گواهی معتبری مطابقت ندارد."}</p>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Row({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-[12px]">
      <span className="text-steel shrink-0">{label}:</span>
      <span className="font-bold truncate" dir={ltr ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
