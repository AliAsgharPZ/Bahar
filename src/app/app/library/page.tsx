"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Plus, Search, HandHeart, Undo2, Trash2, Pencil, TriangleAlert, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/client";
import { faNumber, formatDateFa } from "@/lib/persian";
import { PageHeader, StatCard, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";

type Book = { id: string; title: string; author: string | null; isbn: string | null; category: string | null; shelf: string | null; totalCopies: number; loanedCount: number; available: number };
type Loan = { id: string; bookId: string; bookTitle: string; studentId: string; studentName: string; className: string; loanedAt: string; dueAt: string; overdue: boolean };
type MyLoan = { id: string; bookTitle: string; bookAuthor: string | null; studentName: string; loanedAt: string; dueAt: string; returnedAt: string | null; overdue: boolean };
type LibData = { canManage: boolean; books: Book[]; activeLoans: Loan[]; myLoans: MyLoan[]; stats: { titles: number; copies: number; activeLoans: number; overdue: number } };
type StudentRow = { id: string; studentNumber: string | null; user: { firstName: string; lastName: string }; class: { name: string } | null };

const emptyForm = { title: "", author: "", isbn: "", category: "", shelf: "", totalCopies: 1 };

export default function LibraryPage() {
  const [data, setData] = useState<LibData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loanFor, setLoanFor] = useState<Book | null>(null);
  const [studentQ, setStudentQ] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [dueDays, setDueDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const load = useCallback((query = q) => {
    setLoading(true);
    apiGet<LibData>(`/api/library${query ? `?q=${encodeURIComponent(query)}` : ""}`)
      .then((d) => { setData(d); setLoadError(""); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "خطا در بارگذاری"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(""); }, [load]);

  const searchStudents = useCallback((term: string) => {
    if (term.trim().length < 2) { setStudents([]); return; }
    apiGet<{ students: StudentRow[] }>(`/api/students?q=${encodeURIComponent(term.trim())}`)
      .then((d) => setStudents((d.students ?? []).slice(0, 8)))
      .catch(() => setStudents([]));
  }, []);

  async function saveBook() {
    if (form.title.trim().length < 2) { toast.error("عنوان کتاب را وارد کنید."); return; }
    setBusy(true);
    try {
      await apiPost("/api/library", editing
        ? { action: "updateBook", id: editing.id, ...form }
        : { action: "createBook", ...form });
      toast.success(editing ? "کتاب ویرایش شد." : "کتاب به کاتالوگ اضافه شد.");
      setShowForm(false); setEditing(null); setForm(emptyForm);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function deleteBook(b: Book) {
    if (!window.confirm(`کتاب «${b.title}» حذف شود؟`)) return;
    try {
      await apiPost("/api/library", { action: "deleteBook", id: b.id });
      toast.success("کتاب حذف شد.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  async function loanTo(studentId: string) {
    if (!loanFor) return;
    setBusy(true);
    try {
      await apiPost("/api/library", { action: "loan", bookId: loanFor.id, studentId, dueDays });
      toast.success("کتاب امانت داده شد.");
      setLoanFor(null); setStudents([]); setStudentQ("");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
    finally { setBusy(false); }
  }

  async function returnLoan(loan: Loan) {
    try {
      await apiPost("/api/library", { action: "return", loanId: loan.id });
      toast.success("بازگشت کتاب ثبت شد.");
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "خطا"); }
  }

  const overdueLoans = useMemo(() => (data?.activeLoans ?? []).filter((l) => l.overdue), [data]);

  return (
    <div>
      <PageHeader
        title="کتابخانهٔ مدرسه"
        desc="کاتالوگ کتاب‌های مدرسه، امانت به دانش‌آموزان و پیگیری بازگشت"
        action={data?.canManage ? (
          <button className="b-btn b-btn-spring" onClick={() => { setEditing(null); setForm(emptyForm); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> کتاب جدید
          </button>
        ) : undefined}
      />

      {loadError && <ErrorBox message={loadError} />}
      {loading && !data ? <LoadingBlock /> : data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 b-auto-stagger">
            <StatCard label="عنوان کتاب" value={faNumber(data.stats.titles)} icon={BookOpen} />
            <StatCard label="کل نسخه‌ها" value={faNumber(data.stats.copies)} icon={LibraryBig} tone="soft" />
            <StatCard label="در امانت" value={faNumber(data.stats.activeLoans)} icon={HandHeart} tone="blossom" />
            <StatCard label="دیرکرد" value={faNumber(data.stats.overdue)} icon={TriangleAlert} tone={data.stats.overdue > 0 ? "warning" : "soft"} />
          </div>

          {/* جستجو */}
          <form className="b-card p-3 mb-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); load(q); }}>
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-stone" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو: عنوان، نویسنده، شابک، موضوع…" className="b-input w-full ps-9" />
            </div>
            <button type="submit" className="b-btn b-btn-soft">جستجو</button>
          </form>

          {/* کاتالوگ */}
          {data.books.length === 0 ? (
            <EmptyState icon={BookOpen} title="کتابی در کاتالوگ نیست" desc={data.canManage ? "با دکمهٔ «کتاب جدید» اولین کتاب را اضافه کنید." : "هنوز کتابی ثبت نشده است."} />
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3 mb-8 b-auto-stagger">
              {data.books.map((b) => (
                <article key={b.id} className="b-card b-card-hover p-4">
                  <div className="flex items-start gap-3">
                    <span className="w-11 h-14 shrink-0 rounded-md flex items-center justify-center text-white font-extrabold text-lg" style={{ background: "linear-gradient(150deg, var(--spring), var(--blossom))" }} aria-hidden="true">
                      {b.title[0] ?? "ک"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[14.5px] leading-snug truncate">{b.title}</h3>
                      <p className="text-[12px] text-stone mt-0.5 truncate">{b.author ?? "نویسنده نامشخص"}{b.category ? ` · ${b.category}` : ""}</p>
                      <p className="text-[11px] text-stone mt-0.5">{b.shelf ? `قفسه ${b.shelf} · ` : ""}{b.isbn ? `شابک ${b.isbn}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3.5">
                    <span className={`b-badge ${b.available > 0 ? "b-badge-success" : "b-badge-critical"}`}>
                      {b.available > 0 ? `${faNumber(b.available)} نسخه آزاد از ${faNumber(b.totalCopies)}` : "همه در امانت"}
                    </span>
                    {data.canManage && (
                      <span className="ms-auto flex gap-1">
                        <button className="b-btn b-btn-soft b-btn-sm" disabled={b.available === 0 || busy} onClick={() => { setLoanFor(b); setStudents([]); setStudentQ(""); }}>
                          <HandHeart className="w-3.5 h-3.5" /> امانت
                        </button>
                        <button className="b-btn b-btn-ghost b-icon-btn" title="ویرایش" onClick={() => { setEditing(b); setForm({ title: b.title, author: b.author ?? "", isbn: b.isbn ?? "", category: b.category ?? "", shelf: b.shelf ?? "", totalCopies: b.totalCopies }); setShowForm(true); }}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button className="b-btn b-btn-ghost b-icon-btn" title="حذف" onClick={() => deleteBook(b)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* امانت‌های فعال (کادر) */}
          {data.canManage && (
            <section className="b-card p-4 md:p-5 mb-8">
              <h2 className="font-extrabold text-[15px] mb-3">امانت‌های فعال {overdueLoans.length > 0 && <span className="b-badge b-badge-critical ms-2">{faNumber(overdueLoans.length)} دیرکرد</span>}</h2>
              {data.activeLoans.length === 0 ? (
                <p className="text-[13px] text-stone">امانت فعالی وجود ندارد.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="b-table w-full">
                    <thead><tr><th>کتاب</th><th>دانش‌آموز</th><th>کلاس</th><th>امانت</th><th>مهلت بازگشت</th><th></th></tr></thead>
                    <tbody className="b-rows-in">
                      {data.activeLoans.map((l) => (
                        <tr key={l.id} className={l.overdue ? "text-[--critical]" : undefined}>
                          <td className="font-semibold">{l.bookTitle}</td>
                          <td>{l.studentName}</td>
                          <td>{l.className}</td>
                          <td>{formatDateFa(l.loanedAt)}</td>
                          <td>{formatDateFa(l.dueAt)}{l.overdue && <span className="b-badge b-badge-critical ms-2">دیرکرد</span>}</td>
                          <td><button className="b-btn b-btn-soft b-btn-sm" onClick={() => returnLoan(l)}><Undo2 className="w-3.5 h-3.5" /> بازگشت</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* امانت‌های من (دانش‌آموز/ولی) */}
          {!data.canManage && data.myLoans.length > 0 && (
            <section className="b-card p-4 md:p-5">
              <h2 className="font-extrabold text-[15px] mb-3">کتاب‌های امانتی من</h2>
              <div className="flex flex-col gap-2.5">
                {data.myLoans.map((l) => (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl border border-[--hairline]">
                    <BookOpen className="w-5 h-5 text-spring shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[13.5px] truncate">{l.bookTitle}</p>
                      <p className="text-[11.5px] text-stone">{l.studentName} · مهلت: {formatDateFa(l.dueAt)}</p>
                    </div>
                    {l.returnedAt
                      ? <span className="b-badge b-badge-success">برگشته</span>
                      : l.overdue
                        ? <span className="b-badge b-badge-critical">دیرکرد — لطفاً برگردانید</span>
                        : <span className="b-badge b-badge-warning">در امانت</span>}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* فرم کتاب */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="b-card w-full max-w-md p-5 b-pop">
            <h3 className="font-extrabold text-[16px] mb-4">{editing ? "ویرایش کتاب" : "کتاب جدید"}</h3>
            <div className="flex flex-col gap-3">
              <label className="b-field"><span>عنوان *</span><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="b-input" placeholder="مثلاً ریاضی ششم دبستان" /></label>
              <label className="b-field"><span>نویسنده</span><input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className="b-input" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label className="b-field"><span>موضوع</span><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="b-input" placeholder="داستان، علمی…" /></label>
                <label className="b-field"><span>قفسه</span><input value={form.shelf} onChange={(e) => setForm({ ...form, shelf: e.target.value })} className="b-input" placeholder="A-3" /></label>
                <label className="b-field"><span>شابک</span><input value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} className="b-input" dir="ltr" /></label>
                <label className="b-field"><span>تعداد نسخه</span><input type="number" min={1} max={500} value={form.totalCopies} onChange={(e) => setForm({ ...form, totalCopies: Number(e.target.value) || 1 })} className="b-input" /></label>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button className="b-btn b-btn-spring flex-1" disabled={busy} onClick={saveBook}>ذخیره</button>
              <button className="b-btn b-btn-ghost" onClick={() => { setShowForm(false); setEditing(null); }}>لغو</button>
            </div>
          </div>
        </div>
      )}

      {/* پنجره امانت */}
      {loanFor && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true">
          <div className="b-card w-full max-w-md p-5 b-pop">
            <h3 className="font-extrabold text-[16px] mb-1">امانت «{loanFor.title}»</h3>
            <p className="text-[12px] text-stone mb-4">دانش‌آموز را جستجو و انتخاب کنید.</p>
            <div className="flex gap-2 mb-3">
              <input value={studentQ} onChange={(e) => { setStudentQ(e.target.value); searchStudents(e.target.value); }} placeholder="نام یا شماره دانش‌آموزی…" className="b-input flex-1" autoFocus />
              <label className="flex items-center gap-1.5 text-[12px] shrink-0">مهلت (روز)
                <input type="number" min={1} max={60} value={dueDays} onChange={(e) => setDueDays(Number(e.target.value) || 14)} className="b-input w-16" />
              </label>
            </div>
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {students.map((s) => (
                <button key={s.id} disabled={busy} onClick={() => loanTo(s.id)} className="b-btn b-btn-ghost text-start p-2.5 rounded-lg border border-[--hairline] hover:border-[--spring] transition-colors">
                  <span className="font-semibold text-[13px]">{s.user.firstName} {s.user.lastName}</span>
                  <span className="text-[11.5px] text-stone ms-2">{s.class?.name ?? "بدون کلاس"}{s.studentNumber ? ` · ${s.studentNumber}` : ""}</span>
                </button>
              ))}
              {studentQ.trim().length >= 2 && students.length === 0 && <p className="text-[12px] text-stone p-2">دانش‌آموزی یافت نشد.</p>}
            </div>
            <button className="b-btn b-btn-ghost w-full mt-4" onClick={() => setLoanFor(null)}>بستن</button>
          </div>
        </div>
      )}
    </div>
  );
}
