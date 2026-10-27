"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Loader2, Send, Info, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";

type Log = { id: string; audience: string; text: string; recipientCount: number; status: string; createdAt: string };
type ClassRow = { id: string; name: string; academicYear: string };

const AUD: Record<string, string> = { PARENTS: "اولیا", TEACHERS: "کارکنان", STUDENTS: "دانش‌آموزان", CLASS: "یک کلاس", ALL: "همه (اولیا + دانش‌آموزان)" };

export default function SmsPage() {
  const { data, loading, error, refetch } = useApi<{ logs: Log[]; provider: string }>("/api/sms");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const [audience, setAudience] = useState("PARENTS");
  const [classId, setClassId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const r = await apiPost<{ recipients: number; notified: number }>("/api/sms", { audience, classId, text });
      toast.success(`ثبت شد — ${faNumber(r.recipients)} شمارهٔ معتبر؛ اعلان درون‌برنامه‌ای برای ${faNumber(r.notified)} نفر ساخته شد.`);
      setText("");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : "خطا"); }
    finally { setSending(false); }
  }

  const logs = data?.logs ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="پنل پیامک" desc="ارسال گروهی پیام به اولیا، کارکنان یا دانش‌آموزان." />
      <div className="rounded-xl bg-blossom/10 border border-blossom/30 p-4 flex items-start gap-2 text-[12.5px]">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blossom" />
        <span>در این استقرار نمایشی، درگاه پیامک واقعی وصل نیست؛ ارسال‌ها با وضعیت «نمایشی» در لاگ ثبت می‌شوند و هم‌زمان اعلان درون‌برنامه‌ای برای گیرندگان ساخته می‌شود تا چرخه کامل تست شود. با اتصال درگاه (کاوه‌نگار/ملی‌پیامک و…) همین پنل واقعی می‌شود.</span>
      </div>

      <div className="b-card p-6 flex flex-col gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">مخاطب</span>
            <Select className="w-full" buttonClassName="!w-full" value={audience} onChange={setAudience}
              options={Object.entries(AUD).map(([value, label]) => ({ value, label }))} placeholder="مخاطب" /></label>
          {audience === "CLASS" && (
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">کلاس</span>
              <Select className="w-full" buttonClassName="!w-full" value={classId} onChange={setClassId}
                options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder="انتخاب کلاس" /></label>
          )}
        </div>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">متن پیامک ({faNumber(text.length)}/۵۰۰)</span>
          <textarea className="b-input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
            placeholder="مثلاً: اولیای گرامی، جلسهٔ انجمن اولیا و مربیان روز پنجشنبه ساعت ۱۷ برگزار می‌شود. — دبیرستان بهار" /></label>
        <button className="b-btn b-btn-spring self-start" disabled={sending || text.trim().length < 3 || (audience === "CLASS" && !classId)} onClick={send}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} ارسال
        </button>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && logs.length === 0 && <EmptyState icon={MessageSquare} title="هنوز پیامی ارسال نشده" />}
      {logs.length > 0 && (
        <div className="b-card overflow-x-auto b-scroll">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead><tr className="text-steel border-b border-hairline">
              <th className="p-3 text-start font-bold">زمان</th>
              <th className="p-3 text-start font-bold">مخاطب</th>
              <th className="p-3 text-start font-bold">متن</th>
              <th className="p-3 text-start font-bold">گیرنده</th>
              <th className="p-3 text-start font-bold">وضعیت</th>
            </tr></thead>
            <tbody className="b-rows-in">
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-hairline last:border-0">
                  <td className="p-3 whitespace-nowrap">{formatDateFa(l.createdAt)}</td>
                  <td className="p-3">{AUD[l.audience] ?? l.audience}</td>
                  <td className="p-3 max-w-72 truncate">{l.text}</td>
                  <td className="p-3">{faNumber(l.recipientCount)} شماره</td>
                  <td className="p-3"><span className="b-badge b-badge-neutral">نمایشی</span></td>
                  <td className="p-3"><button className="text-stone hover:text-destructive" aria-label="حذف رکورد" onClick={async () => { if (!window.confirm("این رکورد ارسال حذف شود؟")) return; try { await apiDelete(`/api/sms?id=${l.id}`); toast.success("حذف شد."); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
