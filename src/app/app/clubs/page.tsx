"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trophy, Loader2, Plus, UserCheck, UserX, Power, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Club = {
  id: string; name: string; coach: string | null; weekday: number; timeLabel: string | null;
  capacity: number; minGrade: string | null; maxGrade: string | null; fee: number;
  isActive: boolean; enrolledCount: number;
};
type MyEnr = { clubId: string; studentId: string; status: string };
type StudentRow = { id: string; name: string };
type ClassRow = { id: string; name: string; academicYear: string };
type Me = { user: { role: string } };

const DAY_TKEY = ["", "clubs.day.sat", "clubs.day.sun", "clubs.day.mon", "clubs.day.tue", "clubs.day.wed", "clubs.day.thu", "clubs.day.fri"];

export default function ClubsPage() {
  const { t } = useLang();
  const { data: me } = useApi<Me>("/api/auth/me");
  const role = me?.user.role ?? "";
  const isStaff = ["MANAGER", "DEPUTY", "TEACHER", "SUPER_ADMIN", "ADMIN"].includes(role);
  const isParent = role === "PARENT";
  const { data, loading, error, refetch } = useApi<{ clubs: Club[]; myEnrollments: MyEnr[] }>("/api/clubs");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>(isParent ? "/api/classes" : null);
  const [classId, setClassId] = useState("");
  const { data: roster } = useApi<{ students: StudentRow[] }>(classId ? `/api/seating?classId=${classId}` : null);
  const [childId, setChildId] = useState("");
  const [form, setForm] = useState({ name: "", coach: "", weekday: "3", timeLabel: "", capacity: "30", minGrade: "", maxGrade: "", fee: "0" });
  const [busy, setBusy] = useState("");

  const children = roster?.students ?? [];
  const targetStudent = role === "STUDENT" ? undefined : childId;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      await apiPost("/api/clubs", { action: "create", ...form, weekday: Number(form.weekday), capacity: Number(form.capacity), fee: Number(form.fee) });
      toast.success(t("clubs.toast.created"));
      setForm({ name: "", coach: "", weekday: "3", timeLabel: "", capacity: "30", minGrade: "", maxGrade: "", fee: "0" });
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  async function enroll(club: Club, drop: boolean, enrolled?: boolean) {
    setBusy(club.id);
    try {
      const r = await apiPost<{ waitlisted?: boolean }>("/api/clubs", {
        action: drop ? "drop" : "enroll", clubId: club.id, studentId: targetStudent,
      });
      if (!drop) toast.success(r.waitlisted ? t("clubs.toast.waitlisted") : t("clubs.toast.enrolled"));
      if (drop) toast.success(t("clubs.toast.dropped"));
      void enrolled;
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  async function toggle(club: Club) {
    setBusy(club.id);
    try { await apiPost("/api/clubs", { action: "toggle", id: club.id }); refetch(); }
    catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setBusy(""); }
  }

  const clubs = data?.clubs ?? [];
  const myMap = new Map((data?.myEnrollments ?? []).map((e) => [`${e.clubId}|${e.studentId}`, e.status]));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("clubs.title")} desc={t("clubs.desc")} />
      {isParent && (
        <div className="flex items-end gap-3 flex-wrap">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.childClass")}</span>
            <Select value={classId} onChange={(v) => { setClassId(v); setChildId(""); }}
              options={[{ value: "", label: t("clubs.select.class") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("common.class")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.child")}</span>
            <Select value={childId} onChange={setChildId}
              options={[{ value: "", label: t("clubs.select.child") }, ...children.map((s) => ({ value: s.id, label: s.name }))]} placeholder={t("clubs.child")} /></label>
        </div>
      )}

      {isStaff && (
        <form onSubmit={create} className="b-card p-5 grid md:grid-cols-4 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.field.name")}</span>
            <input className="b-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder={t("clubs.placeholder.name")} required /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.coach")}</span>
            <input className="b-input" value={form.coach} onChange={(e) => setForm((f) => ({ ...f, coach: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.field.weekday")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={form.weekday} onChange={(v) => setForm((f) => ({ ...f, weekday: v }))}
              options={DAY_TKEY.slice(1).map((key, i) => ({ value: String(i + 1), label: key ? t(key) : "" }))} placeholder={t("dashboard.uptime.day")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.time")}</span>
            <input className="b-input" value={form.timeLabel} onChange={(e) => setForm((f) => ({ ...f, timeLabel: e.target.value }))} placeholder={t("clubs.placeholder.time")} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.capacity")}</span>
            <input className="b-input" type="number" min={1} value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.field.grades")}</span>
            <span className="flex gap-1.5">
              <input className="b-input" value={form.minGrade} onChange={(e) => setForm((f) => ({ ...f, minGrade: e.target.value }))} placeholder={t("clubs.grade.first")} />
              <input className="b-input" value={form.maxGrade} onChange={(e) => setForm((f) => ({ ...f, maxGrade: e.target.value }))} placeholder={t("clubs.grade.sixth")} />
            </span></label>
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("clubs.field.fee")}</span>
            <input className="b-input" dir="ltr" type="number" min={0} value={form.fee} onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))} /></label>
          <span className="flex items-end">
            <button className="b-btn b-btn-spring" disabled={busy === "create"}>
              {busy === "create" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} {t("clubs.create")}
            </button>
          </span>
        </form>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && clubs.length === 0 && <EmptyState icon={Trophy} title={t("clubs.empty")} />}
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4 b-auto-stagger">
        {clubs.map((c) => {
          const full = c.enrolledCount >= c.capacity;
          const myStatus = role === "STUDENT"
            ? (data?.myEnrollments ?? []).find((e) => e.clubId === c.id)?.status
            : childId ? myMap.get(`${c.id}|${childId}`) : undefined;
          return (
            <div key={c.id} className={`b-card-md p-5 flex flex-col gap-2 ${!c.isActive ? "opacity-60" : ""}`}>
              <span className="flex items-center justify-between gap-2">
                <b className="text-[16px]">{c.name}</b>
                <span className={`b-badge ${c.isActive ? "b-badge-spring" : "b-badge-blossom"}`}>{c.isActive ? t("common.active") : t("common.inactive")}</span>
              </span>
              <span className="text-[12px] text-steel">{DAY_TKEY[c.weekday] ? t(DAY_TKEY[c.weekday]) : ""}{c.timeLabel ? ` · ${c.timeLabel}` : ""}{c.coach ? ` · ${t("clubs.coach")}: ${c.coach}` : ""}</span>
              <span className="text-[12px] text-steel">
                {t("clubs.capacity")}: {faNumber(c.enrolledCount)} {t("common.from")} {faNumber(c.capacity)}{full ? ` (${t("clubs.full")})` : ""}
                {c.minGrade || c.maxGrade ? ` · ${t("clubs.gradePrefix")} ${c.minGrade ?? "…"} ${t("common.to")} ${c.maxGrade ?? "…"}` : ""}
                {c.fee > 0 ? ` · ${t("clubs.fee")} ${faNumber(c.fee)} ${t("clubs.currency")}` : ` · ${t("clubs.free")}`}
              </span>
              <span className="flex gap-1.5 mt-1 flex-wrap">
                {!isStaff && myStatus && (
                  <span className={`b-badge ${myStatus === "ENROLLED" ? "b-badge-spring" : "b-badge-neutral"}`}>{myStatus === "ENROLLED" ? t("clubs.enrolled") : t("clubs.waitlisted")}</span>
                )}
                {!isStaff && (role === "STUDENT" || childId) && c.isActive && (
                  myStatus
                    ? <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === c.id} onClick={() => enroll(c, true)}><UserX className="w-3.5 h-3.5" /> {t("clubs.cancelEnroll")}</button>
                    : <button className="b-btn b-btn-spring b-btn-sm" disabled={busy === c.id} onClick={() => enroll(c, false)}><UserCheck className="w-3.5 h-3.5" /> {full ? t("clubs.waitlisted") : t("clubs.enroll")}</button>
                )}
                {isStaff && (
                  <button className="b-btn b-btn-ghost b-btn-sm" disabled={busy === c.id} onClick={() => toggle(c)}>
                    <Power className="w-3.5 h-3.5" /> {c.isActive ? t("common.inactive") : t("common.active")}
                  </button>
                )}
                {isStaff && (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" disabled={busy === c.id}
                    onClick={async () => { if (!window.confirm(`${t("clubs.deleteConfirm.club")} «${c.name}» ${t("clubs.deleteConfirm.suffix")}`)) return; try { await apiDelete(`/api/clubs?id=${c.id}`); toast.success(t("clubs.toast.deleted")); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}>
                    <Trash2 className="w-3.5 h-3.5" /> {t("common.delete")}
                  </button>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
