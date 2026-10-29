"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, Eye, Pencil, KeyRound, Loader2, Trash2, Users, GraduationCap, Phone, Send, Check, Download, Tag, Bookmark, X, ListChecks, Home, Copy } from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete, apiGet } from "@/lib/client";
import { useShellUser } from "@/components/app-shell/app-shell";
import { useLang } from "@/lib/i18n";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatCard, StatusBadge } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Select, useConfirm } from "@/components/shared/pickers";
import { faNumber, enDigits, STUDENT_STATUS_LABELS, formatDateFa } from "@/lib/persian";

type ClassRow = { id: string; name: string; grade: string; field: string | null };
type ParentRow = { studentId: string; parentUserId: string; relation: string; isPrimary: boolean; parentUser: { id: string; nationalId: string; firstName: string; lastName: string; phone: string | null; shadNumber: string | null; jobTitle: string | null } };
type StudentRow = {
  id: string;
  studentNumber: string;
  status: string;
  entryYear: string | null;
  healthNotes: string | null;
  classId: string | null;
  user: { id: string; nationalId: string; firstName: string; lastName: string; fatherName: string | null; gender: string | null; shadNumber: string | null; phone: string | null; isActive: boolean; mustChangePassword: boolean; profileImageType: "upload" | "avatar" | null; photoUrl: string | null; avatar: import("@/lib/avatar").AvatarParams | null };
  class: ClassRow | null;
  parents: ParentRow[];
};

type ParentForm = { nationalId: string; firstName: string; lastName: string; relation: string; phone: string; shadNumber: string; jobTitle: string; education: string };

type SavedViewRow = { id: string; name: string; config: string };
type HouseRow = { id: string; name: string };

type ViewConfig = { classId?: string; q?: string };

const emptyStudent = {
  nationalId: "", firstName: "", lastName: "", fatherName: "", gender: "", birthDate: "",
  birthPlace: "", phone: "", shadNumber: "", address: "", classId: "", studentNumber: "",
  entryYear: "", previousSchool: "", healthNotes: "",
};

const emptyParent: ParentForm = { nationalId: "", firstName: "", lastName: "", relation: "FATHER", phone: "", shadNumber: "", jobTitle: "", education: "" };

export default function StudentsPage() {
  const { t } = useLang();
  const confirm = useConfirm();
  const [classId, setClassId] = useState("");
  const [q, setQ] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyStudent);
  const [parents, setParents] = useState<ParentForm[]>([{ ...emptyParent }]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ password: string; shadDelivery: { ok: boolean; error?: string }; parents: Array<{ nationalId: string; firstName: string; lastName: string; password?: string; isNew: boolean; shadDelivery?: { ok: boolean } | undefined }>; name: string; nationalId: string } | null>(null);
  const [detail, setDetail] = useState<StudentRow | null>(null);
  const [detailData, setDetailData] = useState<{ student: StudentRow & { gradeRecords: Array<{ id: string; score: number; maxScore: number; term: number; kind: string; subject: { name: string } }>; attendances: Array<{ id: string; date: string; status: string; note: string | null }> } } | null>(null);

  // عملیات گروهی + نمایه‌های ذخیره‌شده
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkTag, setBulkTag] = useState("");
  const [bulkHouse, setBulkHouse] = useState("");
  const [viewName, setViewName] = useState("");
  const [viewsRefresh, setViewsRefresh] = useState(0);

  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const { data: housesData } = useApi<{ houses: HouseRow[] }>("/api/houses");
  const { data: viewsData, refetch: refetchViews } = useApi<{ views: SavedViewRow[] }>("/api/saved-views?page=students", [viewsRefresh]);
  const studentsUrl = `/api/students?${classId ? `classId=${classId}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}`;
  const { data, loading, error, refetch } = useApi<{ students: StudentRow[] }>(studentsUrl, [classId, q]);

  const classOptions = classesData?.classes ?? [];
  const houseOptions = housesData?.houses ?? [];
  const savedViews = viewsData?.views ?? [];
  const students = data?.students ?? [];

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function setParent(i: number, k: keyof ParentForm, v: string) {
    setParents((ps) => ps.map((p, idx) => (idx === i ? { ...p, [k]: v } : p)));
  }

  async function createStudent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost<{
        password: string;
        shadDelivery: { ok: boolean; error?: string };
        parents: Array<{ nationalId: string; firstName: string; lastName: string; password?: string; isNew: boolean; shadDelivery?: { ok: boolean } | undefined }>;
        user: { firstName: string; lastName: string; nationalId: string };
      }>("/api/students", {
        ...form,
        nationalId: enDigits(form.nationalId),
        shadNumber: enDigits(form.shadNumber),
        phone: enDigits(form.phone),
        parents: parents.filter((p) => p.nationalId).map((p) => ({ ...p, nationalId: enDigits(p.nationalId), shadNumber: enDigits(p.shadNumber), phone: enDigits(p.phone) })),
      });
      toast.success(t("students.toast.created"));
      setResult({ password: res.password, shadDelivery: res.shadDelivery, parents: res.parents, name: `${res.user.firstName} ${res.user.lastName}`, nationalId: res.user.nationalId });
      setShowCreate(false);
      setForm(emptyStudent);
      setParents([{ ...emptyParent }]);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("students.toast.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function openDetail(s: StudentRow) {
    setDetail(s);
    setDetailData(null);
    try {
      const d = await import("@/lib/client").then((m) => m.apiGet<{ student: StudentRow & { gradeRecords: Array<{ id: string; score: number; maxScore: number; term: number; kind: string; subject: { name: string } }>; attendances: Array<{ id: string; date: string; status: string; note: string | null }> } }>(`/api/students/${s.id}`));
      setDetailData(d);
    } catch {
      toast.error(t("students.toast.loadFailed"));
    }
  }

  async function resetPassword(s: StudentRow) {
    try {
      const res = await apiPatch<{ password: string | null }>(`/api/students/${s.id}`, { resetPassword: true });
      if (res.password) {
        setResult({
          password: res.password, shadDelivery: { ok: false, error: "" },
          parents: [], name: `${s.user.firstName} ${s.user.lastName}`, nationalId: s.user.nationalId,
        });
        toast.success(t("students.toast.passwordReset"));
        refetch();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  // ---------- ویرایش / غیرفعال‌سازی دانش‌آموز ----------
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(emptyStudent);
  const [editParents, setEditParents] = useState<ParentRow[]>([]);
  const [removedParents, setRemovedParents] = useState<string[]>([]);
  const [newParent, setNewParent] = useState<ParentForm>({ ...emptyParent });
  const [editSaving, setEditSaving] = useState(false);

  async function openEdit(s: StudentRow) {
    setEditId(s.id);
    setRemovedParents([]);
    setNewParent({ ...emptyParent });
    setEditParents([]);
    setEditForm({ ...emptyStudent });
    try {
      const d = await apiGet<{ student: StudentRow & { user: Record<string, string | null>; previousSchool: string | null } }>(`/api/students/${s.id}`);
      const st = d.student;
      setEditParents(st.parents ?? []);
      const u = st.user as unknown as Record<string, string | null>;
      setEditForm({
        nationalId: String(u.nationalId ?? ""),
        firstName: String(u.firstName ?? ""),
        lastName: String(u.lastName ?? ""),
        fatherName: u.fatherName ?? "",
        gender: u.gender ?? "",
        birthDate: u.birthDate ? String(u.birthDate).slice(0, 10) : "",
        birthPlace: u.birthPlace ?? "",
        phone: u.phone ?? "",
        shadNumber: u.shadNumber ?? "",
        address: u.address ?? "",
        classId: st.classId ?? "",
        studentNumber: st.studentNumber ?? "",
        entryYear: st.entryYear ?? "",
        previousSchool: st.previousSchool ?? "",
        healthNotes: st.healthNotes ?? "",
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("students.toast.loadInfoFailed"));
      setEditId(null);
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editId) return;
    setEditSaving(true);
    try {
      const payload: Record<string, unknown> = {
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        fatherName: editForm.fatherName,
        gender: editForm.gender,
        birthDate: editForm.birthDate || null,
        birthPlace: editForm.birthPlace,
        phone: enDigits(editForm.phone),
        shadNumber: enDigits(editForm.shadNumber),
        address: editForm.address,
        classId: editForm.classId || null,
        studentNumber: editForm.studentNumber,
        entryYear: editForm.entryYear,
        previousSchool: editForm.previousSchool,
        healthNotes: editForm.healthNotes,
      };
      if (removedParents.length) payload.removeParentIds = removedParents;
      if (newParent.nationalId) {
        payload.addParent = {
          nationalId: enDigits(newParent.nationalId),
          firstName: newParent.firstName,
          lastName: newParent.lastName,
          relation: newParent.relation,
          phone: enDigits(newParent.phone),
          shadNumber: enDigits(newParent.shadNumber),
          jobTitle: newParent.jobTitle,
          education: newParent.education,
        };
      }
      await apiPatch(`/api/students/${editId}`, payload);
      toast.success(t("students.toast.saved"));
      setEditId(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("students.toast.saveFailed"));
    } finally {
      setEditSaving(false);
    }
  }

  async function deactivateStudent(s: StudentRow) {
    if (!(await confirm({ title: t("students.deactivate.title"), description: `${t("students.deactivate.verb")} «${s.user.firstName} ${s.user.lastName}»؟ ${t("students.deactivate.descRest")}`, confirmLabel: t("students.deactivate.confirm"), danger: true }))) return;
    try {
      await apiDelete(`/api/students/${s.id}`);
      toast.success(t("students.toast.deactivated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  // ---------- عملیات گروهی ----------
  function toggleSel(id: string) {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSel((prev) => (prev.size === students.length ? new Set() : new Set(students.map((s) => s.id))));
  }

  async function runBulk(action: string, extra: Record<string, unknown> = {}) {
    if (sel.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await apiPost<{ updated: number }>("/api/students/bulk", { action, ids: Array.from(sel), ...extra });
      toast.success(`${t("students.toast.bulkPrefix")} ${faNumber(res.updated)} ${t("students.toast.bulkSuffix")}`);
      setSel(new Set());
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("students.toast.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  }

  // ---------- نمایه‌های ذخیره‌شده ----------
  async function saveView() {
    const name = viewName.trim();
    if (!name) { toast.error(t("students.toast.viewNameRequired")); return; }
    try {
      await apiPost("/api/saved-views", { page: "students", name, config: JSON.stringify({ classId, q }) });
      toast.success(t("students.toast.viewSaved"));
      setViewName("");
      setViewsRefresh((v) => v + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("students.toast.viewSaveFailed"));
    }
  }

  function applyView(v: SavedViewRow) {
    try {
      const cfg = JSON.parse(v.config) as ViewConfig;
      setClassId(cfg.classId ?? "");
      setQ(cfg.q ?? "");
    } catch {
      toast.error(t("students.toast.viewInvalid"));
    }
  }

  async function deleteView(id: string) {
    try {
      await apiDelete(`/api/saved-views?id=${id}`);
      setViewsRefresh((v) => v + 1);
    } catch {
      toast.error(t("students.toast.viewDeleteFailed"));
    }
  }

  const stats = useMemo(() => {
    return {
      total: students.length,
      withShad: students.filter((s) => s.user.shadNumber).length,
      parents: new Set(students.flatMap((s) => s.parents.map((p) => p.parentUserId))).size,
    };
  }, [data]);

  /* راند ۱۸: شاد اختیاری — فیلدها/آمار فقط وقتی دیده می‌شوند که مدرسه فعال کرده باشد */
  const { user: shellUser } = useShellUser();
  const shadVisible = shellUser.schoolModules ? shellUser.schoolModules.shadEnabled !== false : true;

  /** کپی سریع اعتبارنامه با بازخورد */
  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} ${t("students.toast.copied")}`);
    } catch {
      toast.error(t("students.toast.copyFailed"));
    }
  }
  function copyCred(name: string, nationalId: string, password?: string) {
    copyText(
      `${name} — ${t("students.cred.username")} ${nationalId}` + (password ? ` — ${t("students.cred.password")} ${password}` : "") + "\n" + t("students.cred.firstLoginNote"),
      `${t("students.cred.title")} ${name}`
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.students")}
        desc={t("students.header.desc")}
        action={
          <button className="b-btn b-btn-spring b-btn-sm" onClick={() => { setShowCreate(true); setResult(null); }}>
            <Plus className="w-4 h-4" /> {t("students.new")}
          </button>
        }
      />

      {/* راند ۱۹: در موبایل تک‌ستونه — قبلاً ۳ ستونِ ۱۱۹px متن برچسب کارت‌ها را نامرئی می‌کرد */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={GraduationCap} label={t("students.stat.filtered")} value={stats.total} tone="spring" />
        {shadVisible && <StatCard icon={Send} label={t("students.stat.withShad")} value={stats.withShad} />}
        <StatCard icon={Users} label={t("students.stat.parents")} value={stats.parents} tone="ink" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="b-search-pill max-w-xs">
          <Search className="w-4 h-4 shrink-0" />
          <input className="b-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("students.search.placeholder")} />
        </div>
        <Select
          value={classId}
          onChange={(v) => setClassId(v)}
          options={[{ value: "", label: t("students.allClasses") }, ...classOptions.map((c) => ({ value: c.id, label: c.name }))]}
          placeholder={t("students.allClasses")}
        />
        <a
          href={`/api/students/bulk?${classId ? `classId=${classId}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}`}
          className="b-btn b-btn-ghost b-btn-sm ms-auto"
          title={t("students.exportCsvTitle")}
        >
          <Download className="w-4 h-4" /> {t("students.exportCsv")}
        </a>
      </div>

      {/* نمایه‌های ذخیره‌شده */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11.5px] text-steel flex items-center gap-1.5 shrink-0">
          <Bookmark className="w-3.5 h-3.5" /> {t("students.views.label")}
        </span>
        {savedViews.map((v) => (
          <span key={v.id} className="b-pill-tab !cursor-default group">
            <button className="b-btn b-btn-ghost hover:text-spring font-bold" onClick={() => applyView(v)} title={t("students.views.applyTitle")}>{v.name}</button>
            <button className="b-btn b-btn-ghost text-stone hover:text-blossom" onClick={() => deleteView(v.id)} title={t("students.views.deleteTitle")}>
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {savedViews.length === 0 && <span className="text-[11px] text-stone">{t("students.views.hint")}</span>}
        <span className="flex items-center gap-1.5 ms-auto">
          <input
            className="b-input !w-36 !h-9 !text-[12px]"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveView()}
            placeholder={t("students.views.namePlaceholder")}
            maxLength={40}
          />
          <button className="b-btn b-btn-soft b-btn-sm" onClick={saveView}>
            <Bookmark className="w-3.5 h-3.5" /> {t("students.views.saveCurrent")}
          </button>
        </span>
      </div>

      {/* نوار عملیات گروهی */}
      {sel.size > 0 && (
        <div className="b-card-sm !rounded-2xl border-spring/40 bg-spring-tint/60 flex flex-wrap items-center gap-2.5 sticky top-16 z-20">
          <span className="text-[12.5px] font-bold flex items-center gap-1.5 text-spring-deep">
            <ListChecks className="w-4 h-4" /> {faNumber(sel.size)} {t("students.bulk.selected")}
          </span>
          <Select
            value=""
            disabled={bulkBusy}
            onChange={(v) => { if (v) runBulk("moveClass", { classId: v === "none" ? null : v }); }}
            options={[{ value: "", label: t("students.bulk.moveToClass") }, { value: "none", label: t("students.noClassDash") }, ...classOptions.map((c) => ({ value: c.id, label: c.name }))]}
            placeholder={t("students.bulk.moveToClass")}
            buttonClassName="!h-9 !text-[12px]"
          />
          <Select
            value=""
            disabled={bulkBusy}
            onChange={(v) => { if (v) runBulk("setStatus", { status: v }); }}
            options={[{ value: "", label: t("students.bulk.changeStatus") }, ...Object.entries(STUDENT_STATUS_LABELS).map(([k]) => ({ value: k, label: k === "ACTIVE" ? t("common.active") : k === "GRADUATED" ? t("enum.studentStatus.GRADUATED") : k === "TRANSFERRED" ? t("enum.studentStatus.TRANSFERRED") : k === "SUSPENDED" ? t("enum.studentStatus.SUSPENDED") : k }))]}
            placeholder={t("students.bulk.changeStatus")}
            buttonClassName="!h-9 !text-[12px]"
          />
          {houseOptions.length > 0 && (
            <Select
              value={bulkHouse}
              disabled={bulkBusy}
              onChange={(v) => setBulkHouse(v)}
              options={[{ value: "", label: t("students.bulk.house") }, { value: "none", label: t("students.noHouseDash") }, ...houseOptions.map((h) => ({ value: h.id, label: h.name }))]}
              placeholder={t("students.bulk.house")}
              buttonClassName="!h-9 !text-[12px]"
            />
          )}
          {bulkHouse && (
            <button className="b-btn b-btn-soft b-btn-sm" disabled={bulkBusy} onClick={() => { runBulk("house", { houseId: bulkHouse === "none" ? null : bulkHouse }); setBulkHouse(""); }}>
              <Home className="w-3.5 h-3.5" /> {t("students.bulk.assignHouse")}
            </button>
          )}
          <span className="flex items-center gap-1.5">
            <input
              className="b-input !w-28 !h-9 !text-[12px]"
              value={bulkTag}
              onChange={(e) => setBulkTag(e.target.value)}
              placeholder={t("students.bulk.tagPlaceholder")}
              maxLength={30}
            />
            <button className="b-btn b-btn-soft b-btn-sm" disabled={bulkBusy || !bulkTag.trim()} onClick={() => { runBulk("tag", { tagKey: bulkTag.trim(), tagMode: "add" }); setBulkTag(""); }}>
              <Tag className="w-3.5 h-3.5" /> {t("students.bulk.addTag")}
            </button>
          </span>
          <button className="b-btn b-btn-ghost b-btn-sm ms-auto" onClick={() => setSel(new Set())}>
            <X className="w-3.5 h-3.5" /> {t("students.bulk.clearSelection")}
          </button>
        </div>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.students.length === 0 && (
        <EmptyState icon={GraduationCap} title={t("students.empty.notFound")} desc={t("students.empty.hint")} />
      )}

      {data && data.students.length > 0 && (
        <div className="b-card-sm overflow-hidden">
          <div className="overflow-x-auto b-scroll">
            <table className="w-full text-[13px] b-rows-in">
              <thead>
                <tr className="border-b border-hairline-soft text-steel text-[11.5px]">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-spring cursor-pointer"
                      checked={students.length > 0 && sel.size === students.length}
                      ref={(el) => { if (el) el.indeterminate = sel.size > 0 && sel.size < students.length; }}
                      onChange={toggleAll}
                      title={t("students.table.selectAll")}
                    />
                  </th>
                  <th className="text-start py-3 px-4 font-bold">{t("students.table.student")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden md:table-cell">{t("common.class")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden lg:table-cell">{t("students.table.nationalId")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden lg:table-cell">{t("students.table.parents")}</th>
                  {shadVisible && <th className="text-start py-3 px-4 font-bold hidden md:table-cell">{t("students.table.shad")}</th>}
                  <th className="text-start py-3 px-4 font-bold">{t("students.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className={`b-row border-b border-hairline-soft/60 last:border-0 ${sel.has(s.id) ? "bg-spring-tint/50" : ""}`}>
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-spring cursor-pointer"
                        checked={sel.has(s.id)}
                        onChange={() => toggleSel(s.id)}
                        aria-label={`${t("students.table.select")} ${s.user.firstName} ${s.user.lastName}`}
                      />
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar user={s.user} size={36} />
                        <span className="flex flex-col min-w-0">
                          <b className="truncate">{s.user.firstName} {s.user.lastName}</b>
                          <span className="text-[11px] text-steel" dir="ltr">{s.studentNumber}</span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell">
                      <span className="b-badge b-badge-spring">{s.class?.name ?? t("students.noClass")}</span>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell"><span dir="ltr" className="font-mono text-[11.5px]">{s.user.nationalId}</span></td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <div className="flex flex-col gap-0.5">
                        {s.parents.map((p) => (
                          <span key={p.parentUserId} className="text-[11.5px] text-steel truncate">
                            {p.relation === "FATHER" ? t("dashboard.relation.father") : p.relation === "MOTHER" ? t("dashboard.relation.mother") : t("dashboard.relation.guardian")}: {p.parentUser.firstName} {p.parentUser.lastName}
                          </span>
                        ))}
                        {!s.parents.length && <span className="text-[11px] text-blossom">{t("students.noParent")}</span>}
                      </div>
                    </td>
                    {shadVisible && (
                      <td className="py-3 px-4 hidden md:table-cell">
                        {s.user.shadNumber ? <span dir="ltr" className="font-mono text-[11.5px]">{s.user.shadNumber}</span> : <span className="text-stone text-[11px]">—</span>}
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors" onClick={() => openDetail(s)} title={t("students.row.viewFile")}>
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors" onClick={() => resetPassword(s)} title={t("students.row.resetPassword")}>
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors" onClick={() => openEdit(s)} title={t("students.row.edit")}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {s.user.isActive && (
                          <button className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => deactivateStudent(s)} title={t("students.row.deactivate")}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* دیالوگ ویرایش دانش‌آموز */}
      {editId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !editSaving && setEditId(null)} aria-hidden />
          <form onSubmit={saveEdit} className="relative b-card p-6 md:p-8 w-full max-w-3xl max-h-[92vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("students.edit.title")}</h2>
            <p className="t-sm text-steel mb-6">{t("students.edit.desc")}</p>

            <div className="grid sm:grid-cols-3 gap-4 mb-6">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("students.field.nationalId")}</span>
                <input className="b-input opacity-70" dir="ltr" value={editForm.nationalId} readOnly />
              </label>
              {[
                { k: "firstName", l: t("students.field.firstName"), dir: "rtl" },
                { k: "lastName", l: t("students.field.lastName"), dir: "rtl" },
                { k: "fatherName", l: t("students.field.fatherName"), dir: "rtl" },
                { k: "birthPlace", l: t("students.field.birthPlace"), dir: "rtl" },
                { k: "phone", l: t("students.field.mobile"), dir: "ltr" },
                ...(shadVisible ? [{ k: "shadNumber", l: t("students.field.shadNumber"), dir: "ltr" }] : []),
                { k: "studentNumber", l: t("students.field.studentNumber"), dir: "ltr" },
                { k: "entryYear", l: t("students.field.entryYear"), dir: "ltr" },
                { k: "previousSchool", l: t("students.field.previousSchool"), dir: "rtl" },
              ].map((f) => (
                <label key={f.k} className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-bold">{f.l}</span>
                  <input
                    className="b-input"
                    dir={f.dir}
                    value={editForm[f.k] ?? ""}
                    onChange={(e) => setEditForm((ef) => ({ ...ef, [f.k]: e.target.value }))}
                    required={f.k === "firstName" || f.k === "lastName"}
                  />
                </label>
              ))}
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("students.field.gender")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={editForm.gender}
                  onChange={(v) => setEditForm((ef) => ({ ...ef, gender: v }))}
                  options={[{ value: "", label: "—" }, { value: "MALE", label: t("enum.gender.MALE") }, { value: "FEMALE", label: t("enum.gender.FEMALE") }]}
                  placeholder="—"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("students.field.class")}</span>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={editForm.classId}
                  onChange={(v) => setEditForm((ef) => ({ ...ef, classId: v }))}
                  options={[{ value: "", label: t("students.noClass") }, ...classOptions.map((c) => ({ value: c.id, label: c.name }))]}
                  placeholder={t("students.noClass")}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-bold">{t("students.field.birthDate")}</span>
                <input className="b-input" dir="ltr" type="date" value={editForm.birthDate} onChange={(e) => setEditForm((ef) => ({ ...ef, birthDate: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-bold">{t("students.field.address")}</span>
                <input className="b-input" value={editForm.address} onChange={(e) => setEditForm((ef) => ({ ...ef, address: e.target.value }))} />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-3">
                <span className="text-[12px] font-bold">{t("students.field.healthNotes")}</span>
                <input className="b-input" value={editForm.healthNotes} onChange={(e) => setEditForm((ef) => ({ ...ef, healthNotes: e.target.value }))} />
              </label>
            </div>

            {/* اولیای فعلی */}
            <div className="mb-6">
              <h3 className="font-bold text-[13.5px] mb-3">{t("students.parents.title")}</h3>
              <div className="flex flex-col gap-2">
                {editParents.map((p) => {
                  const removed = removedParents.includes(p.parentUserId);
                  return (
                    <div key={p.parentUserId} className={`b-card-sm !rounded-xl p-3 flex items-center gap-3 ${removed ? "opacity-45 line-through" : ""}`}>
                      <span className="text-[12.5px] font-bold flex-1 truncate">
                        {p.relation === "FATHER" ? t("dashboard.relation.father") : p.relation === "MOTHER" ? t("dashboard.relation.mother") : t("dashboard.relation.guardian")}: {p.parentUser.firstName} {p.parentUser.lastName}
                      </span>
                      <span className="font-mono text-[11px] text-steel" dir="ltr">{p.parentUser.nationalId}</span>
                      <button
                        type="button"
                        className="b-btn b-btn-ghost text-[11px] font-bold text-destructive hover:underline"
                        onClick={() => setRemovedParents((rs) => (removed ? rs.filter((x) => x !== p.parentUserId) : [...rs, p.parentUserId]))}
                      >
                        {removed ? t("students.parent.restore") : t("students.parent.unlink")}
                      </button>
                    </div>
                  );
                })}
                {editParents.length === 0 && <p className="text-[12px] text-steel">{t("students.parent.noneYet")}</p>}
              </div>

              {/* افزودن ولی جدید */}
              <div className="b-card-sm !rounded-2xl p-4 mt-3 grid sm:grid-cols-3 gap-3">
                <p className="text-[11.5px] font-bold text-steel sm:col-span-3">{t("students.parent.addNewHint")}</p>
                <Select
                  className="w-full"
                  buttonClassName="!w-full"
                  value={newParent.relation}
                  onChange={(v) => setNewParent((np) => ({ ...np, relation: v }))}
                  options={[{ value: "FATHER", label: t("dashboard.relation.father") }, { value: "MOTHER", label: t("dashboard.relation.mother") }, { value: "GUARDIAN", label: t("dashboard.relation.guardian") }]}
                />
                <input className="b-input" dir="ltr" inputMode="numeric" placeholder={t("students.parent.nationalIdPh")} value={newParent.nationalId} onChange={(e) => setNewParent((np) => ({ ...np, nationalId: e.target.value }))} />
                <input className="b-input" placeholder={t("students.ph.firstName")} value={newParent.firstName} onChange={(e) => setNewParent((np) => ({ ...np, firstName: e.target.value }))} />
                <input className="b-input" placeholder={t("students.ph.lastName")} value={newParent.lastName} onChange={(e) => setNewParent((np) => ({ ...np, lastName: e.target.value }))} />
                <input className="b-input" dir="ltr" placeholder={t("students.field.mobile")} value={newParent.phone} onChange={(e) => setNewParent((np) => ({ ...np, phone: e.target.value }))} />
                {shadVisible && <input className="b-input" dir="ltr" placeholder={t("students.field.shadNumber")} value={newParent.shadNumber} onChange={(e) => setNewParent((np) => ({ ...np, shadNumber: e.target.value }))} />}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button type="button" className="b-btn b-btn-ghost b-btn-sm" onClick={() => setEditId(null)} disabled={editSaving}>{t("common.cancel")}</button>
              <button type="submit" className="b-btn b-btn-spring b-btn-sm" disabled={editSaving || !editForm.firstName || !editForm.lastName}>
                {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {t("students.saveChanges")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* دیالوگ ثبت دانش‌آموز */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-3xl max-h-[92vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("students.create.title")}</h2>
            <p className="t-sm text-steel mb-6">{t("students.create.desc")}</p>

            <form onSubmit={createStudent} className="flex flex-col gap-5">
              <div>
                <h3 className="font-bold text-[13.5px] mb-3">{t("students.create.step1")}</h3>
                <div className="grid sm:grid-cols-3 gap-4">
                  {[
                    { k: "nationalId", l: t("students.field.nationalIdUser"), dir: "ltr", ph: t("students.ph.nationalId") },
                    { k: "firstName", l: t("students.field.firstName"), dir: "rtl", ph: "" },
                    { k: "lastName", l: t("students.field.lastName"), dir: "rtl", ph: "" },
                    { k: "fatherName", l: t("students.field.fatherName"), dir: "rtl", ph: "" },
                    { k: "birthPlace", l: t("students.field.birthPlace"), dir: "rtl", ph: "" },
                    { k: "phone", l: t("students.field.mobileStudent"), dir: "ltr", ph: "09…" },
                    ...(shadVisible ? [{ k: "shadNumber", l: t("students.field.shadNumberStudent"), dir: "ltr", ph: "09…" }] : []),
                    { k: "studentNumber", l: t("students.field.studentNumber"), dir: "ltr", ph: t("students.ph.autoIfEmpty") },
                    { k: "entryYear", l: t("students.field.entryYear"), dir: "ltr", ph: "1404" },
                  ].map((f) => (
                    <label key={f.k} className="flex flex-col gap-1.5">
                      <span className="text-[12px] font-bold">{f.l}</span>
                      <input
                        className="b-input"
                        dir={f.dir}
                        inputMode={["nationalId", "phone", "shadNumber", "studentNumber", "entryYear"].includes(f.k) ? "numeric" : undefined}
                        value={form[f.k] ?? ""}
                        onChange={(e) => set(f.k, e.target.value)}
                        placeholder={f.ph}
                        required={f.k === "nationalId" || f.k === "firstName" || f.k === "lastName"}
                      />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">{t("students.field.gender")}</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={form.gender}
                      onChange={(v) => set("gender", v)}
                      options={[{ value: "", label: "—" }, { value: "MALE", label: t("enum.gender.MALE") }, { value: "FEMALE", label: t("enum.gender.FEMALE") }]}
                      placeholder="—"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">{t("students.field.class")}</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={form.classId}
                      onChange={(v) => set("classId", v)}
                      options={[{ value: "", label: t("students.noClass") }, ...classOptions.map((c) => ({ value: c.id, label: c.name }))]}
                      placeholder={t("students.noClass")}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">{t("students.field.birthDate")}</span>
                    <input className="b-input" dir="ltr" type="date" value={form.birthDate} onChange={(e) => set("birthDate", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-bold">{t("students.field.address")}</span>
                    <input className="b-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-bold">{t("students.field.previousSchool")}</span>
                    <input className="b-input" value={form.previousSchool} onChange={(e) => set("previousSchool", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5 sm:col-span-2">
                    <span className="text-[12px] font-bold">{t("students.field.healthNotesFull")}</span>
                    <input className="b-input" value={form.healthNotes} onChange={(e) => set("healthNotes", e.target.value)} />
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-[13.5px]">{t("students.create.step2")}</h3>
                  <button
                    type="button"
                    className="b-btn b-btn-ghost !py-1.5 !px-3 !text-[11.5px] !min-h-8"
                    onClick={() => setParents((ps) => [...ps, { ...emptyParent, relation: "MOTHER" }])}
                  >
                    <Plus className="w-3.5 h-3.5" /> {t("students.addParent")}
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  {parents.map((p, i) => (
                    <div key={i} className="b-card-sm !rounded-2xl p-4 relative">
                      {parents.length > 1 && (
                        <button
                          type="button"
                          className="absolute top-3 end-3 w-7 h-7 rounded-full flex items-center justify-center text-steel hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setParents((ps) => ps.filter((_, idx) => idx !== i))}
                          aria-label={t("students.parent.removeAria")}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="grid sm:grid-cols-3 gap-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.relation")}</span>
                          <Select
                            className="w-full"
                            buttonClassName="!w-full"
                            value={p.relation}
                            onChange={(v) => setParent(i, "relation", v)}
                            options={[{ value: "FATHER", label: t("dashboard.relation.father") }, { value: "MOTHER", label: t("dashboard.relation.mother") }, { value: "GUARDIAN", label: t("dashboard.relation.guardian") }]}
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.nationalIdRequired")}</span>
                          <input className="b-input" dir="ltr" inputMode="numeric" value={p.nationalId} onChange={(e) => setParent(i, "nationalId", e.target.value)} placeholder={t("students.ph.nationalId")} />
                        </label>
                        {shadVisible && (
                          <label className="flex flex-col gap-1.5">
                            <span className="text-[11.5px] font-bold">{t("students.parent.shadNumber")}</span>
                            <input className="b-input" dir="ltr" inputMode="numeric" value={p.shadNumber} onChange={(e) => setParent(i, "shadNumber", e.target.value)} placeholder="09…" />
                          </label>
                        )}
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.firstNameRequired")}</span>
                          <input className="b-input" value={p.firstName} onChange={(e) => setParent(i, "firstName", e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.lastNameRequired")}</span>
                          <input className="b-input" value={p.lastName} onChange={(e) => setParent(i, "lastName", e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.field.mobile")}</span>
                          <input className="b-input" dir="ltr" inputMode="numeric" value={p.phone} onChange={(e) => setParent(i, "phone", e.target.value)} placeholder="09…" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.job")}</span>
                          <input className="b-input" value={p.jobTitle} onChange={(e) => setParent(i, "jobTitle", e.target.value)} />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[11.5px] font-bold">{t("students.parent.education")}</span>
                          <input className="b-input" value={p.education} onChange={(e) => setParent(i, "education", e.target.value)} />
                        </label>
                      </div>
                      <p className="text-[10.5px] text-stone mt-2">{t("students.parent.existingHint")}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("students.create.submit")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)} disabled={saving}>{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* پرونده دانش‌آموز */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => setDetail(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[92vh] overflow-y-auto b-scroll b-pop">
            <div className="flex items-start justify-between gap-3 mb-6">
              <div>
                <h2 className="font-bold text-lg">{detail.user.firstName} {detail.user.lastName}</h2>
                <p className="t-sm text-steel">
                  {detail.class?.name ?? t("students.noClass")} · شماره <span dir="ltr">{detail.studentNumber}</span> · <StatusBadge ok={detail.user.isActive} okLabel={t("common.active")} badLabel={t("common.inactive")} />
                </p>
              </div>
              <button className="b-btn b-btn-ghost !p-0 !min-h-9 w-9 h-9" onClick={() => setDetail(null)} aria-label={t("common.close")}>×</button>
            </div>

            {!detailData && <LoadingBlock label={t("students.detail.loading")} />}
            {detailData && (
              <div className="flex flex-col gap-6">
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { l: t("students.detail.nationalId"), v: detail.user.nationalId, mono: true },
                    { l: t("students.field.fatherName"), v: detail.user.fatherName ?? "—" },
                    { l: t("students.field.gender"), v: detail.user.gender === "MALE" ? t("enum.gender.MALE") : detail.user.gender === "FEMALE" ? t("enum.gender.FEMALE") : "—" },
                    ...(shadVisible ? [{ l: t("students.field.shadNumber"), v: detail.user.shadNumber ?? "—", mono: true }] : []),
                    { l: t("students.field.mobile"), v: detail.user.phone ?? "—", mono: true },
                    { l: t("students.field.entryYear"), v: detail.entryYear ?? "—" },
                    { l: t("students.detail.status"), v: detail.status === "ACTIVE" ? t("common.active") : detail.status === "GRADUATED" ? t("enum.studentStatus.GRADUATED") : detail.status === "TRANSFERRED" ? t("enum.studentStatus.TRANSFERRED") : detail.status === "SUSPENDED" ? t("enum.studentStatus.SUSPENDED") : detail.status },
                    { l: t("students.field.healthNotes"), v: detail.healthNotes ?? "—" },
                  ].map((r) => (
                    <div key={r.l} className="b-card-sm !rounded-xl p-3.5">
                      <div className="text-[10.5px] text-steel mb-0.5">{r.l}</div>
                      <div className={`text-[13px] font-bold ${r.mono ? "font-mono" : ""}`} dir={r.mono ? "ltr" : "rtl"}>{r.v}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <h3 className="font-bold text-[14px] mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-spring" /> {t("students.parents.title")}</h3>
                  <div className="flex flex-col gap-2.5">
                    {detailData.student.parents.map((p) => (
                      <div key={p.parentUserId} className="b-card-sm !rounded-xl p-4 flex items-center justify-between gap-3">
                        <span className="flex flex-col min-w-0">
                          <b className="text-[13px] truncate">{p.parentUser.firstName} {p.parentUser.lastName}</b>
                          <span className="text-[11px] text-steel">{p.relation === "FATHER" ? t("dashboard.relation.father") : p.relation === "MOTHER" ? t("dashboard.relation.mother") : t("dashboard.relation.guardian")} · {p.parentUser.jobTitle ?? "—"}</span>
                        </span>
                        <span className="flex flex-col items-end gap-0.5 shrink-0">
                          <span dir="ltr" className="font-mono text-[11px] text-steel">{p.parentUser.nationalId}</span>
                          {p.parentUser.shadNumber && (
                            <span className="flex items-center gap-1 text-[10.5px] text-spring">
                              <Phone className="w-3 h-3" /> {t("students.detail.shadRegistered")}
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                    {!detailData.student.parents.length && <p className="t-sm text-steel">{t("students.detail.noParent")}</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-[14px] mb-3">{t("students.detail.gradesSummary")}</h3>
                  {detailData.student.gradeRecords.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {Object.entries(
                        detailData.student.gradeRecords.reduce<Record<string, { sum: number; w: number; count: number }>>((acc, g) => {
                          const cur = acc[g.subject.name] ?? { sum: 0, w: 0, count: 0 };
                          cur.sum += (g.score / (g.maxScore || 20)) * 20; cur.w += 1; cur.count++; // FIX راند ۱۶: نرمال‌سازی درست
                          acc[g.subject.name] = cur;
                          return acc;
                        }, {})
                      ).map(([name, v]) => (
                        <div key={name} className="b-card-sm !rounded-xl p-3 text-center">
                          <div className="text-[11px] text-steel truncate">{name}</div>
                          <div className="text-[16px] font-bold">{faNumber(+(v.sum / v.w).toFixed(2))}</div>
                          <div className="text-[9.5px] text-stone">{t("students.detail.avgFrom")} {faNumber(v.count)} {t("students.detail.gradesUnit")}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="t-sm text-steel">{t("students.detail.noGrades")}</p>
                  )}
                </div>

                <div>
                  <h3 className="font-bold text-[14px] mb-3">{t("students.detail.recentAttendance")}</h3>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto b-scroll">
                    {detailData.student.attendances.slice(0, 30).map((a) => (
                      <span
                        key={a.id}
                        className={`b-badge ${a.status === "PRESENT" ? "b-badge-success" : a.status === "ABSENT" ? "b-badge-critical" : a.status === "LATE" ? "b-badge-warning" : "b-badge-neutral"}`}
                        title={a.date}
                      >
                        {a.date} · {a.status === "PRESENT" ? t("enum.attendance.PRESENT") : a.status === "ABSENT" ? t("enum.attendance.ABSENT") : a.status === "LATE" ? t("enum.attendance.LATE") : a.status === "EXCUSED" ? t("enum.attendance.EXCUSED") : a.status}
                      </span>
                    ))}
                    {!detailData.student.attendances.length && <p className="t-sm text-steel">{t("students.detail.noHistory")}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* اعتبارنامه‌ها — راند ۱۸: کپی سریع جایگزین/مکمل شاد */}
      {result && (
        <div className="fixed bottom-4 left-4 right-4 lg:start-auto lg:end-6 z-50 b-card-md !rounded-2xl b-shadow-rail p-5 b-pop max-w-md max-h-[70vh] overflow-y-auto b-scroll">
          <h4 className="font-bold text-[13.5px] flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-spring" /> {t("students.cred.heading")}
          </h4>
          <div className="b-card-sm !rounded-xl p-3.5 mb-2.5">
            <div className="flex items-center justify-between gap-2">
              <b className="text-[12.5px]">{result.name} ({t("common.student")})</b>
              <button
                onClick={() => copyCred(result.name, result.nationalId, result.password)}
                className="b-btn b-btn-ghost !min-h-0 !p-1.5 shrink-0"
                title={t("students.cred.copyStudent")}
                aria-label={t("students.cred.copyStudent")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 text-[12px] mt-1.5">
              <span className="text-steel">{t("students.cred.usernameShort")}</span><b dir="ltr" className="font-mono">{result.nationalId}</b>
              <span className="text-steel">{t("students.cred.passwordShort")}</span><b dir="ltr" className="font-mono">{result.password}</b>
            </div>
            {result.shadDelivery.ok && <span className="b-badge b-badge-success mt-2"><Check className="w-3 h-3" /> {t("students.cred.sentViaShad")}</span>}
          </div>
          {result.parents.filter((p) => p.isNew).map((p) => (
            <div key={p.nationalId} className="b-card-sm !rounded-xl p-3.5 mb-2.5">
              <div className="flex items-center justify-between gap-2">
                <b className="text-[12.5px]">{p.firstName} {p.lastName} ({t("role.parent")})</b>
                <button
                  onClick={() => copyCred(`${p.firstName} ${p.lastName}`, p.nationalId, p.password)}
                  className="b-btn b-btn-ghost !min-h-0 !p-1.5 shrink-0"
                  title={t("students.cred.copyParent")}
                  aria-label={t("students.cred.copyParent")}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr] gap-x-3 text-[12px] mt-1.5">
                <span className="text-steel">{t("students.cred.usernameShort")}</span><b dir="ltr" className="font-mono">{p.nationalId}</b>
                <span className="text-steel">{t("students.cred.passwordShort")}</span><b dir="ltr" className="font-mono">{p.password}</b>
              </div>
              {p.shadDelivery?.ok && <span className="b-badge b-badge-success mt-2"><Check className="w-3 h-3" /> {t("students.cred.sentViaShad")}</span>}
            </div>
          ))}
          <button
            className="b-btn b-btn-soft b-btn-sm mt-1 w-full"
            onClick={() => copyText(
              [`${result.name} — ${t("students.cred.username")} ${result.nationalId} — ${t("students.cred.password")} ${result.password}`]
                .concat(result.parents.filter((p) => p.isNew).map((p) => `${p.firstName} ${p.lastName} (${t("role.parent")}) — ${t("students.cred.username")} ${p.nationalId}${p.password ? ` — ${t("students.cred.password")} ${p.password}` : ""}`))
                .join("\n") + "\n" + t("students.cred.firstLoginNote"),
              t("students.cred.all")
            )}
          >
            <Copy className="w-3.5 h-3.5" /> {t("students.cred.copyAll")}
          </button>
          <button className="b-btn b-btn-soft b-btn-sm mt-2" onClick={() => setResult(null)}>{t("students.cred.acknowledged")}</button>
        </div>
      )}
    </div>
  );
}
