"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Armchair, Loader2, Printer, Save, Shuffle, Eraser } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";

type StudentRow = { id: string; name: string };
type PlanData = { class: { id: string; name: string }; layout: { cols?: number; seats?: Record<string, string> }; students: StudentRow[] };
type ClassRow = { id: string; name: string; grade: string; academicYear: string; _count?: { students: number } };

const ROWS = 8;

export default function SeatingPage() {
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const [classId, setClassId] = useState("");
  const { data, loading, error } = useApi<PlanData>(classId ? `/api/seating?classId=${classId}` : null);
  const [cols, setCols] = useState(5);
  const [seats, setSeats] = useState<Record<string, string>>({});
  const [loadedFor, setLoadedFor] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (data && loadedFor !== data.class.id) {
    setLoadedFor(data.class.id);
    setCols(data.layout.cols ?? 5);
    setSeats(data.layout.seats ?? {});
  }

  const students = data?.students ?? [];
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const seated = useMemo(() => new Set(Object.values(seats)), [seats]);
  const unseated = students.filter((s) => !seated.has(s.id));

  function place(pos: string, studentId: string | null) {
    setSeats((prev) => {
      const next = { ...prev };
      for (const k of Object.keys(next)) if (next[k] === studentId) delete next[k];
      if (studentId) next[pos] = studentId;
      else delete next[pos];
      return next;
    });
  }

  function autoArrange() {
    const next: Record<string, string> = {};
    students.forEach((s, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      if (r < ROWS) next[`${r}-${c}`] = s.id;
    });
    setSeats(next);
    toast.success("چیدمان خودکار اعمال شد.");
  }

  async function save() {
    setSaving(true);
    try {
      await apiPost("/api/seating", { classId, layout: { cols, seats } });
      toast.success("چیدمان ذخیره شد.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="چیدمان صندلی کلاس"
        desc="نقشهٔ نشستن دانش‌آموزان — دانش‌آموز را بکشید و روی صندلی رها کنید؛ جلوی شبکه، تختهٔ کلاس است."
        action={
          <div className="flex items-center gap-2">
            <Select
              value={classId}
              onChange={setClassId}
              options={[{ value: "", label: "انتخاب کلاس" }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]}
              placeholder="انتخاب کلاس"
            />
            {classId && (
              <button className="b-btn b-btn-spring b-btn-sm" disabled={saving} onClick={save}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} ذخیره
              </button>
            )}
          </div>
        }
      />

      {!classId && <EmptyState icon={Armchair} title="کلاسی را انتخاب کنید" desc="چیدمان هر کلاس جدا ذخیره می‌شود." />}
      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}

      {data && (
        <div className="grid lg:grid-cols-[1fr_260px] gap-4 items-start">
          <div className="b-card p-5 flex flex-col gap-4 print:shadow-none" id="seating-print">
            <div className="rounded-xl bg-ink text-white text-center py-2 text-[13px] font-bold">تختهٔ کلاس — {data.class.name}</div>
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-[12px] font-bold">تعداد ستون:</span>
              {[3, 4, 5, 6].map((n) => (
                <button key={n} className={`b-badge ${cols === n ? "b-badge-spring" : "b-badge-neutral"}`} onClick={() => setCols(n)}>{faNumber(n)}</button>
              ))}
              <span className="flex-1" />
              <button className="b-btn b-btn-ghost b-btn-sm" onClick={autoArrange}><Shuffle className="w-4 h-4" /> چیدمان خودکار</button>
              <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => setSeats({})}><Eraser className="w-4 h-4" /> خالی‌کردن</button>
              <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> چاپ</button>
            </div>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
              {Array.from({ length: ROWS * cols }, (_, i) => {
                const r = Math.floor(i / cols);
                const c = i % cols;
                const pos = `${r}-${c}`;
                const sid = seats[pos];
                const st = sid ? byId.get(sid) : null;
                return (
                  <div
                    key={pos}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); if (dragId) place(pos, dragId); setDragId(null); }}
                    onClick={() => { if (sid) place(pos, null); }}
                    title={st ? "برای خالی‌کردن کلیک کنید" : ""}
                    className={`min-h-14 rounded-xl border-2 border-dashed flex items-center justify-center text-center px-1 py-2 text-[12px] font-bold transition-colors ${st ? "border-spring bg-spring-tint/60 border-solid cursor-grab" : "border-hairline text-steel/50"}`}
                    draggable={Boolean(st)}
                    onDragStart={() => st && setDragId(st.id)}
                  >
                    {st ? st.name : `صندلی ${faNumber(r + 1)}-${faNumber(c + 1)}`}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="b-card p-5 flex flex-col gap-3 print:hidden">
            <b className="text-[14px]">بدون صندلی ({faNumber(unseated.length)})</b>
            <p className="text-[11.5px] text-steel">بکشید و روی صندلی خالی رها کنید.</p>
            <div className="flex flex-col gap-1.5 max-h-[480px] overflow-y-auto b-scroll">
              {unseated.map((s) => (
                <div
                  key={s.id}
                  draggable
                  onDragStart={() => setDragId(s.id)}
                  className="rounded-lg bg-cloud px-3 py-2 text-[12.5px] font-bold cursor-grab hover:bg-spring-tint/60"
                >
                  {s.name}
                </div>
              ))}
              {unseated.length === 0 && <p className="text-[12px] text-steel">همه نشسته‌اند.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
