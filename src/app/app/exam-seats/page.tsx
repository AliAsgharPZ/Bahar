"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Armchair, Loader2, Plus, Trash2, Printer, LayoutGrid } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type RoomForm = { name: string; rows: number; cols: number; deskType: "SINGLE" | "DOUBLE" };
type PlanRow = { id: string; title: string; date: string; sessions: number; count: number; createdAt: string };
type ListData = { plans: PlanRow[]; rooms: { id: string; name: string; capacity: number }[] };
type Assignment = { id: string; studentId: string; sessionNo: number; roomName: string; seatNo: number; rowNo: number; colNo: number; studentName: string; studentNumber: string; className: string };
type PlanDetail = { plan: { id: string; title: string; date: string; sessions: number; config: { rooms: RoomForm[]; strategy: string; sessionMode: string } }; assignments: Assignment[] };

const cap = (r: RoomForm) => r.rows * r.cols * (r.deskType === "DOUBLE" ? 2 : 1);

export default function ExamSeatsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<ListData>("/api/exam-seats");
  const { data: classesData } = useApi<{ classes: { id: string; name: string }[] }>("/api/classes");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("1405-10-15");
  const [sessions, setSessions] = useState(1);
  const [sessionMode, setSessionMode] = useState<"ALL_EACH" | "SPLIT">("ALL_EACH");
  const [strategy, setStrategy] = useState<"BY_CLASS" | "MIXED">("MIXED");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [rooms, setRooms] = useState<RoomForm[]>([{ name: "", rows: 5, cols: 6, deskType: "SINGLE" }]);
  const [busy, setBusy] = useState(false);
  const [openPlanId, setOpenPlanId] = useState<string | null>(null);
  const { data: detail } = useApi<PlanDetail>(openPlanId ? `/api/exam-seats?id=${openPlanId}` : null, [openPlanId]);
  const [mapSession, setMapSession] = useState(1);

  const totalCap = useMemo(() => rooms.reduce((s, r) => s + cap(r), 0), [rooms]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const create = async () => {
    setBusy(true);
    try {
      const r = await apiPost<{ id: string; count: number }>("/api/exam-seats", {
        title, date, sessions, sessionMode, strategy, classIds, rooms,
      });
      toast.success(`${t("examSeats.created")} (${faNumber(r.count)})`);
      setOpenPlanId(r.id);
      setMapSession(1);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm(t("examSeats.deleteConfirm"))) return;
    try {
      await apiDelete(`/api/exam-seats?id=${id}`);
      if (openPlanId === id) setOpenPlanId(null);
      refetch();
    } catch {
      toast.error(t("common.error"));
    }
  };

  const detailRooms = detail?.plan.config.rooms ?? [];
  const sessionAssignments = (detail?.assignments ?? []).filter((a) => a.sessionNo === mapSession);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={t("examSeats.title")} desc={t("examSeats.desc")} />

      <div className="b-card p-5 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-52">
            {t("examSeats.planTitle")}
            <input className="b-input !h-11" placeholder={t("examSeats.planTitlePlaceholder")} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("examSeats.date")}
            <input className="b-input !h-11 !w-36" dir="ltr" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold">
            {t("examSeats.sessions")}
            <input className="b-input !h-11 !w-24" type="number" min={1} max={12} value={sessions} onChange={(e) => setSessions(Number(e.target.value) || 1)} />
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-52">
            {t("examSeats.sessionMode")}
            <select className="b-input !h-11" value={sessionMode} onChange={(e) => setSessionMode(e.target.value as "ALL_EACH" | "SPLIT")}>
              <option value="ALL_EACH">{t("examSeats.sessionMode.ALL_EACH")}</option>
              <option value="SPLIT">{t("examSeats.sessionMode.SPLIT")}</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-52">
            {t("examSeats.strategy")}
            <select className="b-input !h-11" value={strategy} onChange={(e) => setStrategy(e.target.value as "BY_CLASS" | "MIXED")}>
              <option value="BY_CLASS">{t("examSeats.strategy.BY_CLASS")}</option>
              <option value="MIXED">{t("examSeats.strategy.MIXED")}</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-bold">{t("examSeats.classes")}</span>
          <div className="flex flex-wrap gap-2">
            {(classesData?.classes ?? []).map((c) => {
              const on = classIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setClassIds(on ? classIds.filter((x) => x !== c.id) : [...classIds, c.id])}
                  className={`b-pill-tab !px-3.5 !py-2 ${on ? "b-pill-tab-active" : ""}`}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-bold">{t("examSeats.rooms")}</span>
          <p className="text-[12px] text-steel">{t("examSeats.roomFromVenues")}</p>
          {rooms.map((r, i) => (
            <div key={i} className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1 text-[12px] font-bold flex-1 min-w-44">
                {t("examSeats.roomName")}
                <input
                  className="b-input !h-11"
                  list="venue-rooms"
                  value={r.name}
                  onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("examSeats.rows")}
                <input className="b-input !h-11 !w-20" type="number" min={1} max={30} value={r.rows} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, rows: Number(e.target.value) || 1 } : x)))} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("examSeats.cols")}
                <input className="b-input !h-11 !w-20" type="number" min={1} max={30} value={r.cols} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, cols: Number(e.target.value) || 1 } : x)))} />
              </label>
              <label className="flex flex-col gap-1 text-[12px] font-bold">
                {t("examSeats.deskType")}
                <select className="b-input !h-11" value={r.deskType} onChange={(e) => setRooms(rooms.map((x, j) => (j === i ? { ...x, deskType: e.target.value as "SINGLE" | "DOUBLE" } : x)))}>
                  <option value="SINGLE">{t("examSeats.desk.SINGLE")}</option>
                  <option value="DOUBLE">{t("examSeats.desk.DOUBLE")}</option>
                </select>
              </label>
              <span className="b-badge b-badge-neutral !h-11 flex items-center">
                {t("examSeats.capacity")}: {faNumber(cap(r))}
              </span>
              <button type="button" className="b-btn b-btn-ghost !h-11" aria-label={t("examSeats.removeRoom")} onClick={() => setRooms(rooms.filter((_, j) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <datalist id="venue-rooms">
            {data.rooms.map((r) => (
              <option key={r.id} value={r.name} />
            ))}
          </datalist>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" className="b-btn b-btn-ghost !h-10" onClick={() => setRooms([...rooms, { name: "", rows: 5, cols: 6, deskType: "SINGLE" }])}>
              <Plus className="w-4 h-4" />
              {t("examSeats.addRoom")}
            </button>
            <span className="text-[12px] font-bold">
              {t("examSeats.totalCapacity")}: {faNumber(totalCap)}
            </span>
            <button type="button" className="b-btn b-btn-primary !h-11 ms-auto" disabled={busy || !title.trim() || !classIds.length} onClick={create}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Armchair className="w-4 h-4" />}
              {t("examSeats.create")}
            </button>
          </div>
        </div>
      </div>

      <div className="b-card p-5 flex flex-col gap-3">
        <h3 className="font-bold text-[15px]">{t("examSeats.plans")}</h3>
        {data.plans.length === 0 ? (
          <EmptyState title={t("examSeats.empty")} />
        ) : (
          data.plans.map((p) => (
            <div key={p.id} className="b-card-sm p-3.5 flex items-center gap-2 flex-wrap">
              <b className="text-[13px]">{p.title}</b>
              <span className="text-[12px] text-steel">{faNumber(p.date)}</span>
              <span className="b-badge b-badge-neutral">{t("examSeats.session")}: {faNumber(p.sessions)}</span>
              <span className="b-badge b-badge-neutral">{faNumber(p.count)}</span>
              <span className="ms-auto flex gap-2">
                <button type="button" className="b-btn b-btn-ghost !h-10" onClick={() => { setOpenPlanId(openPlanId === p.id ? null : p.id); setMapSession(1); }}>
                  <LayoutGrid className="w-4 h-4" />
                  {t("examSeats.seatMap")}
                </button>
                <button type="button" className="b-btn b-btn-ghost !h-10 !text-destructive" onClick={() => remove(p.id)}>
                  <Trash2 className="w-4 h-4" />
                  {t("examSeats.delete")}
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      {detail && openPlanId && (
        <div className="b-card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label={t("examSeats.session")}>
            {Array.from({ length: detail.plan.sessions }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                role="tab"
                aria-selected={mapSession === n}
                onClick={() => setMapSession(n)}
                className={`b-pill-tab !px-3.5 !py-2 ${mapSession === n ? "b-pill-tab-active" : ""}`}
              >
                {t("examSeats.session")} {faNumber(n)}
              </button>
            ))}
            <span className="ms-auto flex gap-2">
              <Link className="b-btn b-btn-ghost !h-10" href={`/print/exam-roster/${detail.plan.id}?session=${mapSession}`} target="_blank">
                <Printer className="w-4 h-4" />
                {t("examSeats.printRoster")}
              </Link>
              <Link className="b-btn b-btn-primary !h-10" href={`/print/exam-cards/${detail.plan.id}?session=${mapSession}`} target="_blank">
                <Printer className="w-4 h-4" />
                {t("examSeats.printCards")}
              </Link>
            </span>
          </div>
          {detailRooms.map((room) => {
            const seats = sessionAssignments.filter((a) => a.roomName === room.name).sort((a, b) => a.seatNo - b.seatNo);
            if (!seats.length) return null;
            const effCols = room.cols * (room.deskType === "DOUBLE" ? 2 : 1);
            return (
              <div key={room.name} className="flex flex-col gap-2">
                <b className="text-[13px]">{room.name} — {faNumber(seats.length)}</b>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${effCols}, minmax(0, 1fr))` }}>
                  {seats.map((a) => (
                    <div key={a.id} className="b-card-sm p-1.5 text-center" title={`${a.studentName} · ${a.className}`}>
                      <div className="text-[11px] font-bold">{faNumber(a.seatNo)}</div>
                      <div className="text-[10px] text-steel truncate">{a.studentName}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
