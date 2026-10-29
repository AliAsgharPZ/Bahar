"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, DoorOpen, Globe, MapPin, Search, Building2, CheckCheck, Ban, Puzzle,
} from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, StatusBadge } from "@/components/shared/bits";
import { IranMapPicker, type RegionSelection } from "@/components/shared/iran-map-picker";
import { Select, useConfirm } from "@/components/shared/pickers";
import { relativeTimeFa, enDigits, faDigits } from "@/lib/persian";
import { getCountrySync } from "@/lib/country/cache";
import { useLang } from "@/lib/i18n";
import { IRAN_PROVINCES, countiesOf } from "@/lib/iran";

type SchoolRow = {
  id: string;
  name: string;
  code: string;
  type: string | null;
  address: string | null;
  phone: string | null;
  province: string | null;
  county: string | null;
  city: string | null;
  establishedYear: number | null;
  motto: string | null;
  about: string | null;
  logoUrl: string | null;
  isActive: boolean;
  /** راند ۱۸: ماژول‌های اختیاری مدرسه */
  shadEnabled?: boolean;
  custodianEnabled?: boolean;
  createdAt: string;
  manager: { id: string; firstName: string; lastName: string; nationalId: string; phone: string | null; shadNumber: string | null } | null;
  site: { subdomain: string; published: boolean; templateId: string } | null;
  studentCount: number;
  teacherCount: number;
  classCount: number;
};

type Me = { user: { role: string; permissions: string[] } };

const emptyForm = {
  name: "", code: "", type: "", province: "", county: "", phone: "", address: "",
  establishedYear: "", motto: "", about: "",
  managerNationalId: "", managerFirstName: "", managerLastName: "", managerPhone: "", managerShadNumber: "",
  forceInvalidNationalId: false,
};

export default function SchoolsPage() {
  const { t } = useLang();
  const confirm = useConfirm();
  const { data: me } = useApi<Me>("/api/auth/me");
  const { data, loading, error, refetch } = useApi<{ schools: SchoolRow[] }>("/api/schools");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [region, setRegion] = useState<RegionSelection>({ provinces: [], counties: [] });
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<SchoolRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editRegion, setEditRegion] = useState<RegionSelection>({ provinces: [], counties: [] });
  // راند ۱۸: ماژول‌های اختیاری مدرسه
  const [editShad, setEditShad] = useState<boolean>(true);
  const [editCustodian, setEditCustodian] = useState<boolean>(true);
  const [editMapOpen, setEditMapOpen] = useState(false);

  const isSuper = me?.user.role === "SUPER_ADMIN";
  // FIX (راند ۱۶): دکمه‌ها با دسترسی‌های واقعی سرویس هم‌راستا شدند (قبلاً ادمینِ فقط-بیننده دکمه‌های 403 می‌دید)
  const perms = me?.user.permissions ?? [];
  const canEditSchools = isSuper || perms.includes("edit_schools");
  const canEnterPanels = isSuper || perms.includes("enter_school_panel");
  const canCreateSchools = isSuper || perms.includes("create_schools");
  const canDeleteSchools = isSuper || perms.includes("delete_schools");

  const schools = useMemo(() => {
    const list = data?.schools ?? [];
    if (!q) return list;
    return list.filter((s) =>
      s.name.includes(q) || s.code.includes(enDigits(q)) ||
      (s.province ?? "").includes(q) || (s.county ?? "").includes(q)
    );
  }, [data, q]);

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function createSchool(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost<{ manager: { password: string; nationalId: string } | null; site: { subdomain: string } }>("/api/schools", {
        ...form,
        establishedYear: form.establishedYear ? Number(enDigits(form.establishedYear)) : undefined,
        county: region.counties[0]?.split("|")[1] ?? form.county,
      });
      toast.success(`${t("schools.toast.created")}${res.site ? ` — ${t("schools.toast.site")} /s/${res.site.subdomain}` : ""}`);
      if (res.manager) {
        toast.info(`${t("schools.toast.managerPassword")} ${res.manager.password} ${t("schools.toast.passwordOnce")}`);
      }
      setShowCreate(false);
      setForm(emptyForm);
      setRegion({ provinces: [], counties: [] });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("schools.toast.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function enterPanel(s: SchoolRow) {
    try {
      await apiPost(`/api/schools/${s.id}/enter`, {});
      toast.success(`${t("schools.toast.enterBefore")} «${s.name}» ${t("schools.toast.enterAfter")}`);
      window.location.href = "/app";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function softDelete(s: SchoolRow) {
    if (!(await confirm({ title: t("schools.deactivate.title"), description: `${t("schools.deactivate.descBefore")} «${s.name}» ${t("schools.deactivate.descAfter")}`, confirmLabel: t("students.deactivate.confirm"), danger: true }))) return;
    try {
      await apiDelete(`/api/schools/${s.id}`);
      toast.success(t("schools.toast.deactivated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function hardDelete(s: SchoolRow) {
    if (!(await confirm({ title: t("schools.delete.title"), description: <>{t("schools.delete.descBefore")} «{s.name}» {t("schools.delete.descMid")}<br />{t("schools.delete.descAfter")}</>, confirmLabel: t("schools.delete.confirm"), danger: true }))) return;
    if (!(await confirm({ title: t("users.delete.finalTitle"), description: t("schools.delete.finalDesc"), confirmLabel: t("users.delete.confirmYes"), danger: true }))) return;
    try {
      await apiDelete(`/api/schools/${s.id}?mode=hard`);
      toast.success(t("schools.toast.deleted"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  function openEdit(s: SchoolRow) {
    setEditing(s);
    setEditForm({
      name: s.name, code: s.code, type: s.type ?? "", phone: s.phone ?? "", address: s.address ?? "",
      establishedYear: s.establishedYear ? String(s.establishedYear) : "", motto: s.motto ?? "", about: s.about ?? "",
      logoUrl: s.logoUrl ?? "",
    });
    setEditShad(s.shadEnabled !== false);
    setEditCustodian(s.custodianEnabled !== false);
    setEditRegion(
      s.province
        ? { provinces: [s.province], counties: s.county ? [`${s.province}|${s.county}`] : [] }
        : { provinces: [], counties: [] }
    );
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiPatch(`/api/schools/${editing.id}`, {
        ...editForm,
        establishedYear: editForm.establishedYear ? Number(enDigits(editForm.establishedYear)) : null,
        province: editRegion.provinces[0] ?? null,
        county: editRegion.counties[0]?.split("|")[1] ?? null,
        isActive: true,
        // راند ۱۸: ماژول‌های اختیاری
        shadEnabled: editShad,
        custodianEnabled: editCustodian,
      });
      toast.success(t("schools.toast.saved"));
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  const counties = form.province ? countiesOf(form.province) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("nav.schools")}
        desc={t("schools.header.desc")}
        action={
          canCreateSchools ? (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> {t("schools.new")}
            </button>
          ) : undefined
        }
      />

      <div className="b-search-pill max-w-xs">
        <Search className="w-4 h-4" />
        <input className="b-input" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("schools.search.placeholder")} />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {schools.length === 0 && !loading && (
        <EmptyState title={t("schools.empty.title")} desc={canCreateSchools ? t("schools.empty.createHint") : t("schools.empty.contactHint")} action={canCreateSchools ? <button className="b-btn b-btn-spring b-btn-sm mt-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> {t("schools.new")}</button> : undefined} />
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {schools.map((s) => {
          return (
            <div key={s.id} className={`b-card p-5 flex flex-col gap-4 ${!s.isActive ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-3">
                {s.logoUrl ? (
                  <img src={s.logoUrl} alt={s.name} className="w-12 h-12 rounded-2xl object-cover border border-hairline" />
                ) : (
                  <span className="w-12 h-12 rounded-2xl bg-spring-tint text-spring flex items-center justify-center shrink-0">
                    <Building2 className="w-6 h-6" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <b className="text-[15px] block truncate">{s.name}</b>
                  <span className="text-[11.5px] text-steel flex items-center gap-1.5 flex-wrap">
                    <span dir="ltr" className="font-mono">{s.code}</span>
                    {s.county && (
                      <>
                        <MapPin className="w-3 h-3" />
                        <span>{s.county}، {s.province}</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                {[
                  { l: t("common.student"), v: s.studentCount },
                  { l: t("common.teacher"), v: s.teacherCount },
                  { l: t("common.class"), v: s.classCount },
                  { l: t("common.manager"), v: s.manager ? 1 : 0 },
                ].map((x, i) => (
                  <div key={i} className="b-card-sm !rounded-xl !p-2">
                    <b className="text-[14px] block">{faDigits(x.v)}</b>
                    <span className="text-[10px] text-steel">{x.l}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-steel">{t("common.manager")}</span>
                  <b className="truncate">{s.manager ? `${s.manager.firstName} ${s.manager.lastName}` : t("schools.manager.unset")}</b>
                </div>
                {s.site && (
                  <div className="flex justify-between">
                    <span className="text-steel">{t("schools.site.label")}</span>
                    {s.site.published ? (
                      <a href={`/s/${s.site.subdomain}`} target="_blank" rel="noreferrer" className="text-spring font-bold hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" /> /s/{s.site.subdomain}
                      </a>
                    ) : (
                      <span className="text-stone">{t("schools.site.draft")}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-hairline-soft">
                {canEditSchools && (
                  <button className="b-btn b-btn-soft b-btn-sm" onClick={() => openEdit(s)}>
                    <Pencil className="w-3.5 h-3.5" /> {t("common.edit")}
                  </button>
                )}
                {canEnterPanels && (
                  <button className="b-btn b-btn-spring b-btn-sm" onClick={() => enterPanel(s)}>
                    <DoorOpen className="w-3.5 h-3.5" /> {t("schools.enterPanel")}
                  </button>
                )}
                {canEditSchools && (s.isActive ? (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-steel" onClick={() => softDelete(s)} title={t("schools.deactivate.title")}>
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="b-badge b-badge-neutral !text-[10px]">{t("common.inactive")}</span>
                ))}
                {canDeleteSchools && (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={() => hardDelete(s)} title={t("schools.delete.title")}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ───────── ساخت مدرسه ───────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("schools.new")}</h2>
            <p className="t-sm text-steel mb-6">{t("schools.create.desc")}</p>
            <form onSubmit={createSchool} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.schoolNameRequired")}</span>
                  <input className="b-input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder={t("schools.placeholder.schoolName")} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.schoolCodeRequired")}</span>
                  <input className="b-input" dir="ltr" value={form.code} onChange={(e) => set("code", e.target.value)} required placeholder="BH-101" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.schoolType")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.type}
                    onChange={(v) => set("type", v)}
                    options={[{ value: "", label: t("users.selectPlaceholder") }, ...getCountrySync().schoolTypes.map((x) => ({ value: x, label: x }))]}
                    placeholder={t("users.selectPlaceholder")}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.phone")}</span>
                  <input className="b-input" dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.province")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.province}
                    onChange={(v) => { set("province", v); setRegion((r) => ({ ...r, provinces: v ? [v] : [], counties: [] })); }}
                    options={[{ value: "", label: t("schools.select.province") }, ...IRAN_PROVINCES.map((p) => ({ value: p.fa, label: `${p.fa} (${p.center})` }))]}
                    placeholder={t("schools.select.province")}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-spring" /> {t("schools.field.county")}
                  </span>
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      buttonClassName="!w-full"
                      value={region.counties[0]?.split("|")[1] ?? ""}
                      onChange={(v) => setRegion((r) => ({ ...r, counties: v && form.province ? [`${form.province}|${v}`] : [] }))}
                      options={[{ value: "", label: t("schools.select.county") }, ...counties.map((c) => ({ value: c, label: c }))]}
                      placeholder={t("schools.select.county")}
                    />
                    <button type="button" className="b-btn b-btn-soft !px-3" onClick={() => setMapOpen(true)} title={t("schools.map.pickTitle")}>
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">{t("students.field.address")}</span>
                  <input className="b-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.motto")}</span>
                  <input className="b-input" value={form.motto} onChange={(e) => set("motto", e.target.value)} placeholder={t("schools.placeholder.motto")} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.establishedYear")}</span>
                  <input className="b-input" dir="ltr" value={form.establishedYear} onChange={(e) => set("establishedYear", e.target.value)} placeholder="1380" />
                </label>
              </div>

              {/* مدیر */}
              <div className="b-card-sm !rounded-2xl p-5">
                <h3 className="font-bold text-[13.5px] mb-1">{t("role.manager")}</h3>
                <p className="text-[11px] text-stone mb-4">{t("schools.manager.hint")}</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("schools.field.managerNationalId")}</span>
                    <input className="b-input" dir="ltr" inputMode="numeric" value={form.managerNationalId} onChange={(e) => set("managerNationalId", enDigits(e.target.value))} />
                    {isSuper && (
                      <label className="flex items-center gap-2 text-[11px] text-steel mt-0.5 cursor-pointer">
                        <input type="checkbox" className="accent-spring w-4 h-4" checked={form.forceInvalidNationalId} onChange={(e) => set("forceInvalidNationalId", e.target.checked)} />
                        {t("schools.manager.forceInvalid")}
                      </label>
                    )}
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("common.name")}</span>
                    <input className="b-input" value={form.managerFirstName} onChange={(e) => set("managerFirstName", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("students.ph.lastName")}</span>
                    <input className="b-input" value={form.managerLastName} onChange={(e) => set("managerLastName", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("schools.field.managerShad")}</span>
                    <input className="b-input" dir="ltr" inputMode="numeric" value={form.managerShadNumber} onChange={(e) => set("managerShadNumber", enDigits(e.target.value))} placeholder="09…" />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("schools.create.submit")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)} disabled={saving}>{t("common.cancel")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────── ویرایش مدرسه ───────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setEditing(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("common.edit")} {editing.name}</h2>
            <p className="t-sm text-steel mb-6">{t("schools.edit.desc")}</p>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { k: "name", l: t("schools.field.schoolName") }, { k: "code", l: t("schools.field.schoolCode") },
                ].map((f) => (
                  <label key={f.k} className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{f.l}</span>
                    <input className="b-input" value={editForm[f.k] ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, [f.k]: e.target.value }))} />
                  </label>
                ))}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.schoolType")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={editForm.type ?? ""}
                    onChange={(v) => setEditForm((ef) => ({ ...ef, type: v }))}
                    options={[{ value: "", label: "—" }, ...getCountrySync().schoolTypes.map((x) => ({ value: x, label: x }))]}
                    placeholder="—"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.phone")}</span>
                  <input className="b-input" dir="ltr" value={editForm.phone ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, phone: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-spring" /> {t("schools.field.location")}</span>
                  <button type="button" className="b-btn b-btn-ghost b-input flex items-center gap-2" onClick={() => setEditMapOpen(true)}>
                    <MapPin className="w-4 h-4 text-spring" />
                    {editRegion.provinces[0]
                      ? `${editRegion.counties[0]?.split("|")[1] ?? editRegion.provinces[0]}، ${editRegion.provinces[0]}`
                      : t("schools.map.pickIran")}
                  </button>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">{t("students.field.address")}</span>
                  <input className="b-input" value={editForm.address ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, address: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.mottoShort")}</span>
                  <input className="b-input" value={editForm.motto ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, motto: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("schools.field.establishedYear")}</span>
                  <input className="b-input" dir="ltr" value={editForm.establishedYear ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, establishedYear: e.target.value }))} />
                </label>
              </div>

              {/* راند ۱۸: ماژول‌های اختیاری — شاد و نقش سرایدار */}
              <div className="b-card-sm !rounded-2xl p-5">
                <h3 className="font-bold text-[13.5px] flex items-center gap-2 mb-1.5"><Puzzle className="w-4 h-4 text-spring" /> {t("schools.modules.title")}</h3>
                <p className="text-[11px] text-steel mb-4 leading-relaxed">
                  {t("schools.modules.desc")}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditShad((v) => !v)}
                    className={`b-btn b-btn-ghost b-option !items-start !py-3.5 ${editShad ? "b-option-selected" : ""}`}
                    aria-pressed={editShad}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <b className="text-[12.5px]">{t("schools.modules.shad")}</b>
                      <span className="text-[10.5px] text-steel leading-relaxed">
                        {editShad ? t("schools.modules.shadOn") : t("schools.modules.shadOff")}
                      </span>
                    </span>
                    <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${editShad ? "bg-spring" : "bg-cloud"}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editShad ? "start-5" : "start-1"}`} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCustodian((v) => !v)}
                    className={`b-btn b-btn-ghost b-option !items-start !py-3.5 ${editCustodian ? "b-option-selected" : ""}`}
                    aria-pressed={editCustodian}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <b className="text-[12.5px]">{t("schools.modules.custodian")}</b>
                      <span className="text-[10.5px] text-steel leading-relaxed">
                        {editCustodian ? t("schools.modules.custodianOn") : t("schools.modules.custodianOff")}
                      </span>
                    </span>
                    <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${editCustodian ? "bg-spring" : "bg-cloud"}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editCustodian ? "start-5" : "start-1"}`} />
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("common.save")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setEditing(null)}>{t("common.close")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <IranMapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        selection={region}
        onChange={(sel) => {
          setRegion(sel);
          if (sel.provinces[0]) set("province", sel.provinces[0]);
        }}
        title={t("schools.map.createTitle")}
        desc={t("schools.map.createDesc")}
      />
      <IranMapPicker
        open={editMapOpen}
        onClose={() => setEditMapOpen(false)}
        selection={editRegion}
        onChange={setEditRegion}
        title={t("schools.map.editTitle")}
      />
    </div>
  );
}
