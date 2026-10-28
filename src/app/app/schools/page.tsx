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
      toast.success(`مدرسه ساخته شد${res.site ? ` — سایت: /s/${res.site.subdomain}` : ""}`);
      if (res.manager) {
        toast.info(`رمز مدیر: ${res.manager.password} (یک‌بار نمایش داده شد — در گفتگو ذخیره کنید)`);
      }
      setShowCreate(false);
      setForm(emptyForm);
      setRegion({ provinces: [], counties: [] });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا در ساخت مدرسه");
    } finally {
      setSaving(false);
    }
  }

  async function enterPanel(s: SchoolRow) {
    try {
      await apiPost(`/api/schools/${s.id}/enter`, {});
      toast.success(`وارد پنل «${s.name}» شدید — حالا مثل مدیر این مدرسه عمل می‌کنید.`);
      window.location.href = "/app";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function softDelete(s: SchoolRow) {
    if (!(await confirm({ title: "غیرفعال‌سازی مدرسه", description: `مدرسه «${s.name}» غیرفعال شود؟`, confirmLabel: "غیرفعال‌سازی", danger: true }))) return;
    try {
      await apiDelete(`/api/schools/${s.id}`);
      toast.success("مدرسه غیرفعال شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function hardDelete(s: SchoolRow) {
    if (!(await confirm({ title: "حذف کامل مدرسه", description: <>حذف کامل «{s.name}» با همه دانش‌آموزان، کلاس‌ها، نمرات و داده‌ها؟<br />این عمل برگشت‌پذیر نیست!</>, confirmLabel: "حذف کامل", danger: true }))) return;
    if (!(await confirm({ title: "تأیید نهایی", description: "تایید نهایی: واقعاً حذف کامل شود؟", confirmLabel: "بله، حذف کن", danger: true }))) return;
    try {
      await apiDelete(`/api/schools/${s.id}?mode=hard`);
      toast.success("مدرسه به‌طور کامل حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
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
      toast.success("تغییرات مدرسه ذخیره شد.");
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  const counties = form.province ? countiesOf(form.province) : [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="مدارس"
        desc="مدیریت کامل مدارس: شهرستان، لوگو، سایت اختصاصی و ورود مستقیم به پنل هر مدرسه. همهٔ قابلیت‌ها رایگان است."
        action={
          canCreateSchools ? (
            <button className="b-btn b-btn-spring b-btn-sm" onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4" /> مدرسه جدید
            </button>
          ) : undefined
        }
      />

      <div className="b-search-pill max-w-xs">
        <Search className="w-4 h-4" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جست‌وجوی نام، کد یا شهرستان…" />
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {schools.length === 0 && !loading && (
        <EmptyState title="مدرسه‌ای یافت نشد" desc={canCreateSchools ? "اولین مدرسه سرویس بهار را بسازید." : "برای ایجاد مدرسه با مدیر سرویس تماس بگیرید."} action={canCreateSchools ? <button className="b-btn b-btn-spring b-btn-sm mt-2" onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> مدرسه جدید</button> : undefined} />
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

              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { l: "دانش‌آموز", v: s.studentCount },
                  { l: "معلم", v: s.teacherCount },
                  { l: "کلاس", v: s.classCount },
                  { l: "مدیر", v: s.manager ? 1 : 0 },
                ].map((x, i) => (
                  <div key={i} className="b-card-sm !rounded-xl !p-2">
                    <b className="text-[14px] block">{faDigits(x.v)}</b>
                    <span className="text-[10px] text-steel">{x.l}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-steel">مدیر</span>
                  <b className="truncate">{s.manager ? `${s.manager.firstName} ${s.manager.lastName}` : "تعیین نشده"}</b>
                </div>
                {s.site && (
                  <div className="flex justify-between">
                    <span className="text-steel">سایت</span>
                    {s.site.published ? (
                      <a href={`/s/${s.site.subdomain}`} target="_blank" rel="noreferrer" className="text-spring font-bold hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" /> /s/{s.site.subdomain}
                      </a>
                    ) : (
                      <span className="text-stone">پیش‌نویس (منتشر نشده)</span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap mt-auto pt-2 border-t border-hairline-soft">
                {canEditSchools && (
                  <button className="b-btn b-btn-soft b-btn-sm" onClick={() => openEdit(s)}>
                    <Pencil className="w-3.5 h-3.5" /> ویرایش
                  </button>
                )}
                {canEnterPanels && (
                  <button className="b-btn b-btn-spring b-btn-sm" onClick={() => enterPanel(s)}>
                    <DoorOpen className="w-3.5 h-3.5" /> ورود به پنل
                  </button>
                )}
                {canEditSchools && (s.isActive ? (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-steel" onClick={() => softDelete(s)} title="غیرفعال‌سازی">
                    <Ban className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <span className="b-badge b-badge-neutral !text-[10px]">غیرفعال</span>
                ))}
                {canDeleteSchools && (
                  <button className="b-btn b-btn-ghost b-btn-sm !text-destructive" onClick={() => hardDelete(s)} title="حذف کامل">
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
            <h2 className="font-bold text-lg mb-1">مدرسه جدید</h2>
            <p className="t-sm text-steel mb-6">پس از ثبت، آدرس اختصاصی سایت مدرسه (نام-مدرسه در مسیر /s/) خودکار ساخته می‌شود و مدیر می‌تواند تمپلیتش را شخصی‌سازی کند.</p>
            <form onSubmit={createSchool} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">نام مدرسه *</span>
                  <input className="b-input" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder="دبیرستان بهار" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">کد مدرسه *</span>
                  <input className="b-input" dir="ltr" value={form.code} onChange={(e) => set("code", e.target.value)} required placeholder="BH-101" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">نوع مدرسه</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.type}
                    onChange={(v) => set("type", v)}
                    options={[{ value: "", label: "— انتخاب —" }, ...getCountrySync().schoolTypes.map((t) => ({ value: t, label: t }))]}
                    placeholder="— انتخاب —"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">تلفن</span>
                  <input className="b-input" dir="ltr" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">استان</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.province}
                    onChange={(v) => { set("province", v); setRegion((r) => ({ ...r, provinces: v ? [v] : [], counties: [] })); }}
                    options={[{ value: "", label: "— انتخاب استان —" }, ...IRAN_PROVINCES.map((p) => ({ value: p.fa, label: `${p.fa} (${p.center})` }))]}
                    placeholder="— انتخاب استان —"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-spring" /> شهرستان
                  </span>
                  <div className="flex gap-2">
                    <Select
                      className="flex-1"
                      buttonClassName="!w-full"
                      value={region.counties[0]?.split("|")[1] ?? ""}
                      onChange={(v) => setRegion((r) => ({ ...r, counties: v && form.province ? [`${form.province}|${v}`] : [] }))}
                      options={[{ value: "", label: "— انتخاب شهرستان —" }, ...counties.map((c) => ({ value: c, label: c }))]}
                      placeholder="— انتخاب شهرستان —"
                    />
                    <button type="button" className="b-btn b-btn-soft !px-3" onClick={() => setMapOpen(true)} title="انتخاب از نقشه">
                      <MapPin className="w-4 h-4" />
                    </button>
                  </div>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">آدرس</span>
                  <input className="b-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">شعار مدرسه</span>
                  <input className="b-input" value={form.motto} onChange={(e) => set("motto", e.target.value)} placeholder="مدرسه‌ای برای آینده" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">سال تاسیس</span>
                  <input className="b-input" dir="ltr" value={form.establishedYear} onChange={(e) => set("establishedYear", e.target.value)} placeholder="1380" />
                </label>
              </div>

              {/* مدیر */}
              <div className="b-card-sm !rounded-2xl p-5">
                <h3 className="font-bold text-[13.5px] mb-1">مدیر مدرسه</h3>
                <p className="text-[11px] text-stone mb-4">اگر حساب مدیر را از قبل ساخته‌اید فقط کد ملی را وارد کنید؛ وگرنه مشخصات کامل را ثبت کنید.</p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">کد ملی مدیر</span>
                    <input className="b-input" dir="ltr" inputMode="numeric" value={form.managerNationalId} onChange={(e) => set("managerNationalId", enDigits(e.target.value))} />
                    {isSuper && (
                      <label className="flex items-center gap-2 text-[11px] text-steel mt-0.5 cursor-pointer">
                        <input type="checkbox" className="accent-[#00825E] w-4 h-4" checked={form.forceInvalidNationalId} onChange={(e) => set("forceInvalidNationalId", e.target.checked)} />
                        ثبت با کد نامعتبر (سوپرادمین)
                      </label>
                    )}
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">نام</span>
                    <input className="b-input" value={form.managerFirstName} onChange={(e) => set("managerFirstName", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">نام خانوادگی</span>
                    <input className="b-input" value={form.managerLastName} onChange={(e) => set("managerLastName", e.target.value)} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">شماره شاد مدیر</span>
                    <input className="b-input" dir="ltr" inputMode="numeric" value={form.managerShadNumber} onChange={(e) => set("managerShadNumber", enDigits(e.target.value))} placeholder="09…" />
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ساخت مدرسه"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)} disabled={saving}>انصراف</button>
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
            <h2 className="font-bold text-lg mb-1">ویرایش {editing.name}</h2>
            <p className="t-sm text-steel mb-6">همه مشخصات مدرسه قابل تغییر است — لوگو از بخش «سایت مدرسه» آپلود می‌شود.</p>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { k: "name", l: "نام مدرسه" }, { k: "code", l: "کد مدرسه" },
                ].map((f) => (
                  <label key={f.k} className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{f.l}</span>
                    <input className="b-input" value={editForm[f.k] ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, [f.k]: e.target.value }))} />
                  </label>
                ))}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">نوع مدرسه</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={editForm.type ?? ""}
                    onChange={(v) => setEditForm((ef) => ({ ...ef, type: v }))}
                    options={[{ value: "", label: "—" }, ...getCountrySync().schoolTypes.map((t) => ({ value: t, label: t }))]}
                    placeholder="—"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">تلفن</span>
                  <input className="b-input" dir="ltr" value={editForm.phone ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, phone: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-spring" /> موقعیت (استان/شهرستان)</span>
                  <button type="button" className="b-input flex items-center gap-2" onClick={() => setEditMapOpen(true)}>
                    <MapPin className="w-4 h-4 text-spring" />
                    {editRegion.provinces[0]
                      ? `${editRegion.counties[0]?.split("|")[1] ?? editRegion.provinces[0]}، ${editRegion.provinces[0]}`
                      : "انتخاب از نقشه ایران"}
                  </button>
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">آدرس</span>
                  <input className="b-input" value={editForm.address ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, address: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">شعار</span>
                  <input className="b-input" value={editForm.motto ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, motto: e.target.value }))} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">سال تاسیس</span>
                  <input className="b-input" dir="ltr" value={editForm.establishedYear ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, establishedYear: e.target.value }))} />
                </label>
              </div>

              {/* راند ۱۸: ماژول‌های اختیاری — شاد و نقش سرایدار */}
              <div className="b-card-sm !rounded-2xl p-5">
                <h3 className="font-bold text-[13.5px] flex items-center gap-2 mb-1.5"><Puzzle className="w-4 h-4 text-spring" /> ماژول‌های اختیاری</h3>
                <p className="text-[11px] text-steel mb-4 leading-relaxed">
                  هر دو کاملاً اختیاری‌اند؛ خاموش‌کردنشان به کار سامانه آسیبی نمی‌زند — جایشان قابلیت جایگزین (کپی اعتبارنامه روی صفحه) فعال می‌شود.
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditShad((v) => !v)}
                    className={`b-option !items-start !py-3.5 ${editShad ? "b-option-selected" : ""}`}
                    aria-pressed={editShad}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <b className="text-[12.5px]">دروازه شاد</b>
                      <span className="text-[10.5px] text-steel leading-relaxed">
                        {editShad ? "ارسال خودکار رمز و اطلاعیه با شاد روشن است." : "خاموش — رمز کاربرها هنگام ساخت قابل کپی است."}
                      </span>
                    </span>
                    <span className={`ms-auto w-10 h-6 rounded-full shrink-0 transition-colors relative ${editShad ? "bg-spring" : "bg-cloud"}`}>
                      <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${editShad ? "start-5" : "start-1"}`} />
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditCustodian((v) => !v)}
                    className={`b-option !items-start !py-3.5 ${editCustodian ? "b-option-selected" : ""}`}
                    aria-pressed={editCustodian}
                  >
                    <span className="flex flex-col items-start gap-0.5">
                      <b className="text-[12.5px]">نقش سرایدار</b>
                      <span className="text-[10.5px] text-steel leading-relaxed">
                        {editCustodian ? "می‌توانید حساب سرایدار برای امکانات و اموال بسازید." : "خاموش — ساخت حساب سرایدار بسته است."}
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
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "ذخیره"}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setEditing(null)}>بستن</button>
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
        title="انتخاب شهرستان مدرسه"
        desc="یک شهرستان (یا استان) انتخاب کنید — در فهرست مدارس و هدف‌گیری اطلاعیه استفاده می‌شود."
      />
      <IranMapPicker
        open={editMapOpen}
        onClose={() => setEditMapOpen(false)}
        selection={editRegion}
        onChange={setEditRegion}
        title="تغییر موقعیت مدرسه"
      />
    </div>
  );
}
