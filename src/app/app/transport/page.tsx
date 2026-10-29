"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bus, Plus, Pencil, Trash2, Loader2, UserPlus, X, Phone, Users } from "lucide-react";
import { apiGet, apiPost } from "@/lib/client";
import { PageHeader, StatCard, EmptyState, LoadingBlock } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type RouteRow = {
  id: string; name: string; driverName: string | null; driverPhone: string | null;
  vehiclePlate: string | null; vehicleDesc: string | null; capacity: number; stops: string;
  _count?: { assignments: number };
};
type AssignmentRow = {
  id: string; stopName: string | null; monthlyFee: number;
  route: { id: string; name: string } | RouteRow;
  student?: { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };
};
type Data = { staff: boolean; routes: RouteRow[]; assignments: AssignmentRow[] };
type StudentHit = { id: string; user: { firstName: string; lastName: string }; class: { name: string } | null };

const emptyForm = { name: "", driverName: "", driverPhone: "", vehiclePlate: "", vehicleDesc: "", capacity: "20", stops: "" };

export default function TransportPage() {
  const { t } = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [assignRoute, setAssignRoute] = useState<RouteRow | null>(null);
  const [term, setTerm] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [picked, setPicked] = useState<StudentHit | null>(null);
  const [stopName, setStopName] = useState("");
  const [fee, setFee] = useState("");

  function BoardingSection() {
    type BItem = { assignmentId?: string; routeName: string; stopName?: string | null; student?: { name: string; className: string }; boardedAt: string | null; alightedAt: string | null; driverName?: string };
    const [items, setItems] = useState<BItem[] | null>(null);
    const staffMode = data?.staff ?? false;
    const loadB = useCallback(() => {
      apiGet<{ items: BItem[] }>("/api/transport/boarding").then((d) => setItems(d.items ?? [])).catch(() => setItems([]));
    }, []);
    useEffect(() => { loadB(); }, [loadB]);
    async function mark(assignmentId: string, leg: "board" | "alight", value: boolean) {
      try {
        await apiPost("/api/transport/boarding", { assignmentId, leg, value });
        loadB();
      } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    }
    if (items === null) return null;
    if (!staffMode) {
      if (items.length === 0) return null;
      return (
        <div className="b-card p-5 flex flex-col gap-3">
          <b className="text-[14px]">{t("transport.vzayt-srvys-amrvz")}</b>
          {items.map((it, i) => (
            <div key={i} className="flex items-center justify-between gap-3 text-[13px]">
              <span>{it.routeName}</span>
              <span className="flex gap-1.5">
                <span className={`b-badge ${it.boardedAt ? "b-badge-spring" : "b-badge-neutral"}`}>{it.boardedAt ? t("transport.svar-shd") : t("transport.hnvz-svar-nshdh")}</span>
                <span className={`b-badge ${it.alightedAt ? "b-badge-spring" : "b-badge-neutral"}`}>{it.alightedAt ? t("transport.pyadh-shd") : t("transport.dr-msyr")}</span>
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (items.length === 0) return null;
    const byRoute = new Map<string, BItem[]>();
    for (const it of items) byRoute.set(it.routeName, [...(byRoute.get(it.routeName) ?? []), it]);
    return (
      <div className="b-card p-5 flex flex-col gap-4">
        <b className="text-[14px]">{t("transport.svar-v-pyadh-shdn-amrvz-chk-lyst-mraqb-srvys")}</b>
        {[...byRoute.entries()].map(([route, list]) => (
          <div key={route} className="flex flex-col gap-1.5">
            <span className="text-[12px] font-bold text-steel">{route}</span>
            {list.map((it) => (
              <div key={it.assignmentId} className="flex items-center justify-between gap-2 py-1 border-b border-hairline last:border-0 text-[12.5px]">
                <span>{it.student?.name} <span className="text-steel">{it.stopName ?? ""}</span></span>
                <span className="flex gap-1.5">
                  <button className={`b-badge ${it.boardedAt ? "b-badge-spring" : "b-badge-neutral"}`} onClick={() => mark(it.assignmentId!, "board", !it.boardedAt)}>{t("transport.svar")} {it.boardedAt ? "✓" : ""}</button>
                  <button className={`b-badge ${it.alightedAt ? "b-badge-spring" : "b-badge-neutral"}`} onClick={() => mark(it.assignmentId!, "alight", !it.alightedAt)}>{t("transport.pyadh")} {it.alightedAt ? "✓" : ""}</button>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  const load = useCallback(() => { apiGet<Data>("/api/transport").then(setData).catch(() => setData({ staff: false, routes: [], assignments: [] })); }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!assignRoute || term.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(() => {
      apiGet<{ students: StudentHit[] }>(`/api/students?q=${encodeURIComponent(term.trim())}`).then((d) => setHits(d.students ?? [])).catch(() => setHits([]));
    }, 300);
    return () => clearTimeout(t);
  }, [term, assignRoute]);

  async function saveRoute() {
    if (!form?.name.trim()) { toast.error(t("transport.nam-msyr-ra-bnvysyd")); return; }
    setBusy("route");
    try {
      await apiPost("/api/transport", {
        action: editingId ? "updateRoute" : "createRoute",
        id: editingId ?? undefined,
        name: form.name, driverName: form.driverName, driverPhone: form.driverPhone,
        vehiclePlate: form.vehiclePlate, vehicleDesc: form.vehicleDesc,
        capacity: Number(form.capacity) || 20,
        stops: form.stops.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      toast.success(t("transport.msyr-zkhyrh-shd"));
      setForm(null); setEditingId(null); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function removeRoute(r: RouteRow) {
    if (!confirm(`${t("transport.msyr")}${r.name}${t("transport.v-hmh-tkhsys-haysh-hzf-shvd")}`)) return;
    setBusy(r.id);
    try { await apiPost("/api/transport", { action: "deleteRoute", id: r.id }); toast.success(t("transport.hzf-shd")); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function doAssign() {
    if (!assignRoute || !picked) { toast.error(t("transport.dansh-amvz-ra-antkhab-knyd")); return; }
    setBusy("assign");
    try {
      await apiPost("/api/transport", { action: "assign", routeId: assignRoute.id, studentId: picked.id, stopName, monthlyFee: Number(fee) || 0 });
      toast.success(t("transport.dansh-amvz-bh-msyr-azafh-shd"));
      setAssignRoute(null); setPicked(null); setTerm(""); setStopName(""); setFee(""); load();
    } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  async function unassign(a: AssignmentRow) {
    setBusy(a.id);
    try { await apiPost("/api/transport", { action: "unassign", assignmentId: a.id }); load(); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } finally { setBusy(null); }
  }

  if (!data) return <LoadingBlock label={t("transport.srvys-mdrsh")} />;
  const stopsOf = (r: RouteRow) => { try { return JSON.parse(r.stops) as string[]; } catch { return []; } };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.transport")}
        desc={data.staff ? t("transport.msyrha-ranndh-v-khvdrv-aystgah-ha-v-tkhsys-dansh-amvzan-bh-srvys") : t("transport.msyr-srvys-shma-v-atlaaat-ranndh")}
        action={data.staff ? (
          <button className="b-btn b-btn-spring" onClick={() => { setForm(emptyForm); setEditingId(null); }}>
            <Plus className="w-4 h-4" /> {t("transport.msyr-jdyd")}
          </button>
        ) : undefined}
      />

      <BoardingSection />

      {!data.staff && (
        data.assignments.length === 0
          ? <EmptyState icon={Bus} title={t("transport.srvysy-sbt-nshdh")} desc={t("transport.bray-shma-ya-frzndtan-hnvz-msyry-tkhsys-dadh-nshdh-ast")} />
          : <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
              {data.assignments.map((a) => {
                const r = a.route as RouteRow;
                return (
                  <div key={a.id} className="b-card p-5 flex flex-col gap-2">
                    <b className="flex items-center gap-2"><Bus className="w-5 h-5 text-spring" /> {r.name}</b>
                    {a.stopName && <p className="t-sm text-steel">{t("transport.aystgah-svarshdn")}: <b className="text-ink">{a.stopName}</b></p>}
                    {r.driverName && <p className="t-sm text-steel">{t("transport.ranndh")}: {r.driverName}{r.driverPhone ? ` — ${r.driverPhone}` : ""}</p>}
                    {r.vehicleDesc && <p className="t-sm text-steel">{t("transport.khvdrv")}: {r.vehicleDesc}{r.vehiclePlate ? ` (${r.vehiclePlate})` : ""}</p>}
                    {stopsOf(r).length > 0 && <p className="t-sm text-steel">{t("transport.msyr-2")}: {stopsOf(r).join(" ← ")}</p>}
                  </div>
                );
              })}
            </div>
      )}

      {data.staff && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={Bus} label={t("transport.msyrhay-faal")} value={data.routes.length} tone="spring" />
            <StatCard icon={Users} label={t("transport.dansh-amvzan-srvys")} value={data.assignments.length} tone="soft" />
            <StatCard icon={Phone} label={t("transport.ranndgan")} value={data.routes.filter((r) => r.driverName).length} tone="ink" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 b-auto-stagger">
            {data.routes.map((r) => (
              <div key={r.id} className="b-card b-card-hover p-5 flex flex-col gap-2">
                <div className="flex items-start justify-between gap-2">
                  <b className="text-[15px]">{r.name}</b>
                  <span className="b-badge b-badge-neutral">{faNumber(r._count?.assignments ?? 0)}/{faNumber(r.capacity)} {t("dashboard.unit.person")}</span>
                </div>
                <p className="t-sm text-steel">
                  {r.driverName ?? t("transport.ranndh-namshkhs")}{r.driverPhone ? ` — ${r.driverPhone}` : ""}
                  {r.vehicleDesc ? ` · ${r.vehicleDesc}` : ""}{r.vehiclePlate ? ` ${t("transport.plak")} ${r.vehiclePlate}` : ""}
                </p>
                {stopsOf(r).length > 0 && <p className="t-sm text-steel">{t("transport.aystgah-ha")}: {stopsOf(r).join(" ← ")}</p>}
                <div className="flex gap-2 mt-1">
                  <button className="b-btn b-btn-soft b-btn-sm" onClick={() => setAssignRoute(r)}><UserPlus className="w-3.5 h-3.5" /> {t("transport.afzvdn-dansh-amvz")}</button>
                  <button className="b-btn b-btn-ghost b-btn-sm" onClick={() => { setEditingId(r.id); setForm({ name: r.name, driverName: r.driverName ?? "", driverPhone: r.driverPhone ?? "", vehiclePlate: r.vehiclePlate ?? "", vehicleDesc: r.vehicleDesc ?? "", capacity: String(r.capacity), stops: stopsOf(r).join("\n") }); }}><Pencil className="w-3.5 h-3.5" /> {t("common.edit")}</button>
                  <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === r.id} onClick={() => removeRoute(r)}><Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}</button>
                </div>
              </div>
            ))}
            {data.routes.length === 0 && <EmptyState icon={Bus} title={t("transport.msyry-taryf-nshdh")} desc={t("transport.avlyn-msyr-srvys-ra-bsazyd")} />}
          </div>

          {data.assignments.length > 0 && (
            <section className="b-card p-5 md:p-6 flex flex-col gap-3">
              <h2 className="font-bold text-[15px]">{t("transport.fhrst-svaran")}</h2>
              <div className="overflow-x-auto b-scroll">
                <table className="w-full text-[13px]">
                  <thead><tr className="text-steel text-start"><th className="p-2 text-start">{t("common.student")}</th><th className="p-2 text-start">{t("common.class")}</th><th className="p-2 text-start">{t("transport.msyr-2")}</th><th className="p-2 text-start">{t("transport.aystgah")}</th><th className="p-2 text-start">{t("transport.hzynh-mahanh")}</th><th className="p-2"></th></tr></thead>
                  <tbody className="b-rows-in">
                    {data.assignments.map((a) => (
                      <tr key={a.id} className="border-t border-hairline-soft">
                        <td className="p-2 font-bold">{a.student?.user.firstName} {a.student?.user.lastName}</td>
                        <td className="p-2">{a.student?.class?.name ?? "—"}</td>
                        <td className="p-2">{(a.route as RouteRow).name}</td>
                        <td className="p-2">{a.stopName ?? "—"}</td>
                        <td className="p-2">{a.monthlyFee ? `${faNumber(a.monthlyFee)} ${t("transport.tvman")}` : "—"}</td>
                        <td className="p-2"><button className="b-btn b-btn-ghost text-destructive" disabled={busy === a.id} onClick={() => unassign(a)}><X className="w-4 h-4" /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {form && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setForm(null)}>
          <div className="b-card w-full max-w-lg p-6 flex flex-col gap-3 max-h-[90vh] overflow-y-auto b-scroll" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{editingId ? t("transport.vyraysh-msyr") : t("transport.msyr-jdyd")}</h3>
            <input className="b-input" placeholder={t("transport.nam-msyr-msla-msyr-1-shhrk-ghrb")} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="b-input" placeholder={t("transport.nam-ranndh")} value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} />
              <input className="b-input" placeholder={t("transport.mvbayl-ranndh")} value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} />
              <input className="b-input" placeholder={t("transport.shrh-khvdrv-myny-bvs-sfyd")} value={form.vehicleDesc} onChange={(e) => setForm({ ...form, vehicleDesc: e.target.value })} />
              <input className="b-input" placeholder={t("transport.plak-2")} value={form.vehiclePlate} onChange={(e) => setForm({ ...form, vehiclePlate: e.target.value })} />
              <input className="b-input" placeholder={t("transport.zrfyt")} inputMode="numeric" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>
            <textarea className="b-input !min-h-[90px]" placeholder={t("transport.aystgah-ha-hr-aystgah-dr-yk-str-bh-trtyb-hrkt")} value={form.stops} onChange={(e) => setForm({ ...form, stops: e.target.value })} />
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "route"} onClick={saveRoute}>{busy === "route" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setForm(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}

      {assignRoute && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-3" onClick={() => setAssignRoute(null)}>
          <div className="b-card w-full max-w-lg p-6 flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold">{t("transport.afzvdn-dansh-amvz-bh")}{assignRoute.name}»</h3>
            <input className="b-input" placeholder={t("transport.jstjvy-nam-dansh-amvz")} value={term} onChange={(e) => { setTerm(e.target.value); setPicked(null); }} />
            {hits.length > 0 && !picked && (
              <div className="flex flex-col gap-1 max-h-44 overflow-y-auto b-scroll">
                {hits.map((s) => (
                  <button key={s.id} className="b-btn b-btn-ghost b-card-sm !rounded-full p-2.5 text-start text-[13px]" onClick={() => setPicked(s)}>
                    <b>{s.user.firstName} {s.user.lastName}</b> <span className="text-steel">{s.class?.name ?? ""}</span>
                  </button>
                ))}
              </div>
            )}
            {picked && <p className="t-sm">{t("common.selected")}: <b>{picked.user.firstName} {picked.user.lastName}</b></p>}
            <div className="grid grid-cols-2 gap-3">
              <input className="b-input" placeholder={t("transport.aystgah-svarshdn")} value={stopName} onChange={(e) => setStopName(e.target.value)} />
              <input className="b-input" placeholder={t("transport.hzynh-mahanh-tvman")} inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button className="b-btn b-btn-spring flex-1" disabled={busy === "assign"} onClick={doAssign}>{busy === "assign" ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.add")}</button>
              <button className="b-btn b-btn-ghost" onClick={() => setAssignRoute(null)}>{t("common.cancel")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
