"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { GraduationCap, Loader2, Pencil, Trash2 } from "lucide-react";
import { apiGet, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, StatCard, EmptyState, LoadingBlock } from "@/components/shared/bits";

type Graduate = {
  id: string;
  user: { firstName: string; lastName: string; nationalId: string; phone: string | null };
  class: { name: string; grade: string | null } | null;
  alumniProfile: { id: string; graduationYear: string | null; university: string | null; field: string | null; outcome: string | null; phone: string | null; note: string | null } | null;
};
type Data = { graduates: Graduate[]; stats: { total: number; withOutcome: number } };

const emptyEdit = { graduationYear: "", university: "", field: "", outcome: "", phone: "", note: "" };

export default function AlumniPage() {
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<Graduate | null>(null);
  const [form, setForm] = useState(emptyEdit);
  const [term, setTerm] = useState("");

  const load = useCallback(() => { apiGet<Data>("/api/alumni").then(setData).catch(() => setData({ graduates: [], stats: { total: 0, withOutcome: 0 } })); }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!editing) return;
    setBusy("save");
    try {
      await apiPost("/api/alumni", { studentId: editing.id, ...form });
      toast.success("پرونده به‌روز شد.");
      setEditing(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label="فارغ‌التحصیلان…" />;
  const rows = data.graduates.filter((g) => !term.trim() || `${g.user.firstName} ${g.user.lastName}`.includes(term.trim()) || (g.alumniProfile?.university ?? "").includes(term.trim()));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="فارغ‌التحصیلان" desc="رجیستری دانش‌آموختگان مدرسه و نتایج آنان — قبولی دانشگاه و رشته، برای پیگیری و معرفی مدرسه." />
      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={GraduationCap} label="کل فارغ‌التحصیلان" value={data.stats.total} tone="spring" />
        <StatCard icon={GraduationCap} label="با نتیجه ثبت‌شده" value={data.stats.withOutcome} tone="soft" />
      </div>
      <input className="b-input max-w-sm" placeholder="جستجو بر اساس نام یا دانشگاه…" value={term} onChange={(e) => setTerm(e.target.value)} />
      {rows.length === 0
        ? <EmptyState icon={GraduationCap} title="فارغ‌التحصیلی نیست" desc="دانش‌آموزی با وضعیت «فارغ‌التحصیل» یافت نشد. وضعیت دانش‌آموز از صفحه دانش‌آموزان قابل تغییر است." />
        : <section className="b-card p-5 md:p-6 overflow-x-auto b-scroll">
            <table className="w-full text-[13px]">
              <thead><tr className="text-steel"><th className="p-2 text-start">نام</th><th className="p-2 text-start">سال فراغت</th><th className="p-2 text-start">دانشگاه</th><th className="p-2 text-start">رشته</th><th className="p-2 text-start">نتیجه</th><th className="p-2"></th></tr></thead>
              <tbody className="b-rows-in">
                {rows.map((g) => (
                  <tr key={g.id} className="border-t border-hairline-soft">
                    <td className="p-2 font-bold whitespace-nowrap">{g.user.firstName} {g.user.lastName}</td>
                    <td className="p-2">{g.alumniProfile?.graduationYear ?? "—"}</td>
                    <td className="p-2">{g.alumniProfile?.university ?? "—"}</td>
                    <td className="p-2">{g.alumniProfile?.field ?? "—"}</td>
                    <td className="p-2">{g.alumniProfile?.outcome ?? "—"}</td>
                    <td className="p-2">
                      <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => {
                        setEditing(g);
                        const p = g.alumniProfile;
                        setForm({ graduationYear: p?.graduationYear ?? "", university: p?.university ?? "", field: p?.field ?? "", outcome: p?.outcome ?? "", phone: p?.phone ?? g.user.phone ?? "", note: p?.note ?? "" });
                      }}><Pencil className="w-3.5 h-3.5" /> ویرایش</button>
                      {g.alumniProfile && (
                        <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={async () => { if (!window.confirm(`پروندهٔ فارغ‌التحصیلی ${g.user.firstName} ${g.user.lastName} حذف شود؟`)) return; try { await apiDelete(`/api/alumni?id=${g.alumniProfile!.id}`); toast.success("حذف شد."); load(); } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); } }}>
                          <Trash2 className="w-3.5 h-3.5" /> حذف
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>}

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setEditing(null)}>
          <div className="b-card w-full max-w-md p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{editing.user.firstName} {editing.user.lastName}</h3>
            <div className="grid grid-cols-2 gap-3">
              <input className="b-input" placeholder="سال فراغت (۱۴۰۳)" value={form.graduationYear} onChange={(e) => setForm({ ...form, graduationYear: e.target.value })} />
              <input className="b-input" placeholder="موبایل" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <input className="b-input" placeholder="دانشگاه / مؤسسه" value={form.university} onChange={(e) => setForm({ ...form, university: e.target.value })} />
            <input className="b-input" placeholder="رشته قبولی" value={form.field} onChange={(e) => setForm({ ...form, field: e.target.value })} />
            <input className="b-input" placeholder="نتیجه (قبولی کنکور سراسری، رتبه و…)" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} />
            <textarea className="b-input !min-h-[70px]" placeholder="یادداشت" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "save"} onClick={save}>{busy === "save" ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setEditing(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
