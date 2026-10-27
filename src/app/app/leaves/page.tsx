"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarOff, Plus, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState , ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";

type Leave = { id: string; kind: string; fromDate: string; toDate: string; reason: string | null; status: string; reviewNote: string | null; createdAt: string; user: { firstName: string; lastName: string; role: string } };
const KINDS: Record<string, string> = { PERSONAL: "شخصی", SICK: "استعلاجی", MISSION: "مأموریت", UNPAID: "بدون حقوق" };
const STATUS: Record<string, string> = { PENDING: "در انتظار", APPROVED: "تأییدشده", REJECTED: "ردشده" };

export default function LeavesPage() {
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [kinds, setKinds] = useState<Record<string, string>>({});
  const [canReview, setCanReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ kind: "PERSONAL", fromDate: "", toDate: "", reason: "" });

  const load = useCallback(() => {
    apiGet<{ leaves: Leave[]; kinds: Record<string, string>; canReview: boolean }>("/api/leaves")
      .then((d) => { setLoadError(""); setLeaves(d.leaves); setKinds(d.kinds); setCanReview(d.canReview); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری مرخصی‌ها"))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  async function submit() {
    if (!form.fromDate || !form.toDate) { toast.error("بازه تاریخ لازم است"); return; }
    try {
      await apiPost("/api/leaves", { action: "request", ...form });
      toast.success("درخواست ثبت شد و به مدیر اطلاع داده شد");
      setForm({ kind: "PERSONAL", fromDate: "", toDate: "", reason: "" }); setShowNew(false); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }
  async function respond(id: string, status: string) {
    try { await apiPost("/api/leaves", { action: "respond", leaveId: id, status }); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  if (loading) return <LoadingBlock />;
  if (loadError) return <ErrorBox message={loadError} />;
  return (
    <div>
      <PageHeader
        title="مرخصی‌ها"
        desc={canReview ? "درخواست‌های مرخصی کارکنان مدرسه" : "درخواست‌های مرخصی شما"}
        action={<button onClick={() => setShowNew((v) => !v)} className="b-btn b-btn-sm b-btn-spring"><Plus className="w-4 h-4" /> درخواست مرخصی</button>}
      />
      {showNew && (
        <div className="b-card-md p-5 mb-6 grid gap-3 sm:grid-cols-4">
          <Select
            value={form.kind}
            onChange={(v) => setForm({ ...form, kind: v })}
            options={Object.entries(kinds).map(([k, v]) => ({ value: k, label: v }))}
            className="w-full"
            buttonClassName="!w-full"
          />
          <input type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="b-input" title="از تاریخ" />
          <input type="date" value={form.toDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="b-input" title="تا تاریخ" />
          <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="دلیل" className="b-input" />
          <button onClick={submit} className="b-btn b-btn-sm b-btn-spring sm:col-span-4 w-fit">ثبت درخواست</button>
        </div>
      )}
      {leaves.length === 0 ? <EmptyState icon={CalendarOff} title="مرخصی ثبت نشده" /> : (
        <div className="flex flex-col gap-2.5">
          {leaves.map((l) => (
            <div key={l.id} className="b-card-sm p-4 flex items-center gap-3 flex-wrap">
              <span className={`b-badge ${l.status === "APPROVED" ? "b-badge-success" : l.status === "REJECTED" ? "b-badge-critical" : "b-badge-warning"}`}>{STATUS[l.status]}</span>
              {canReview && <span className="text-[13px] font-bold">{l.user.firstName} {l.user.lastName}</span>}
              <span className="b-badge b-badge-neutral">{KINDS[l.kind]}</span>
              <span className="text-[12px] text-steel">{formatDateFa(l.fromDate)} تا {formatDateFa(l.toDate)}</span>
              {l.reason && <span className="text-[11.5px] text-steel flex-1 truncate">{l.reason}</span>}
              {l.reviewNote && <span className="text-[11px] text-spring-deep">{l.reviewNote}</span>}
              <button className="b-btn b-btn-ghost b-btn-sm !text-destructive ms-auto" onClick={async () => { if (!window.confirm("این درخواست مرخصی حذف شود؟")) return; try { await apiDelete(`/api/leaves?id=${l.id}`); toast.success("حذف شد."); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}>حذف</button>
              {canReview && l.status === "PENDING" && (
                <span className="flex gap-1.5 ms-auto">
                  <button onClick={() => respond(l.id, "APPROVED")} className="b-btn b-btn-sm b-btn-spring !min-h-[28px] !text-[10px] !px-2.5 !py-0"><CheckCircle2 className="w-3.5 h-3.5" /> تأیید</button>
                  <button onClick={() => respond(l.id, "REJECTED")} className="b-btn b-btn-sm b-btn-ghost !min-h-[28px] !text-[10px] !px-2.5 !py-0 !text-destructive"><XCircle className="w-3.5 h-3.5" /> رد</button>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
