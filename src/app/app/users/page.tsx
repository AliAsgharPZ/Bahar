"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Plus, Search, KeyRound, Pencil, Send, Loader2, ShieldCheck, UserRoundX, Eye,
  Trash2, CheckCircle2, UsersRound, Building2, IdCard, Loader, Copy,
} from "lucide-react";
import { useApi, apiPost, apiPatch, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState, RoleBadge, StatusBadge } from "@/components/shared/bits";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  PERMISSION_CATALOG, SERVICE_PERMISSION_GROUPS, ALL_SERVICE_PERMISSIONS,
} from "@/lib/roles";

const ROLE_TKEY: Record<string, string> = {
  SUPER_ADMIN: "role.superAdmin",
  ADMIN: "role.admin",
  MANAGER: "role.manager",
  DEPUTY: "role.deputy",
  TEACHER: "role.teacher",
  CUSTODIAN: "role.custodian",
  STUDENT: "role.student",
  PARENT: "role.parent",
};
import { formatDateFa, relativeTimeFa, enDigits, faDigits } from "@/lib/persian";
import { JalaliDateInput } from "@/components/shared/jalali-date-input";
import { Select, useConfirm } from "@/components/shared/pickers";
import { useLang } from "@/lib/i18n";

type UserRow = {
  id: string;
  nationalId: string;
  role: string;
  roleLabel: string;
  firstName: string;
  lastName: string;
  fatherName: string | null;
  gender: string | null;
  phone: string | null;
  homePhone: string | null;
  shadNumber: string | null;
  email: string | null;
  address: string | null;
  postalCode: string | null;
  birthPlace: string | null;
  birthDate: string | null;
  education: string | null;
  fieldOfStudy: string | null;
  jobTitle: string | null;
  staffCode: string | null;
  photoUrl: string | null;
  profileImageType: "upload" | "avatar" | null;
  avatar: { hair: string; facialHair: string; body: string; eyes: string; mouth: string; nose: string; accessories: string; skinColor: string; hairColor: string; facialHairColor: string; bodyColor: string; accessoriesColor: string; bgColor: string } | null;
  isActive: boolean;
  permissions: string[];
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  createdAt: string;
  schoolId: string | null;
  school: { id: string; name: string } | null;
  studentProfile: { studentNumber: string; class: { name: string } | null } | null;
  parentOf: Array<{ student: { user: { firstName: string; lastName: string }; class: { name: string } | null } }>;
};

type Me = {
  user: {
    role: string;
    permissions: string[];
    schoolName: string | null;
    school: { name: string; id: string; shadEnabled?: boolean; custodianEnabled?: boolean } | null;
    actingSchool: { id: string; name: string; shadEnabled?: boolean; custodianEnabled?: boolean } | null;
  };
};

const GENDERS: Record<string, string> = { MALE: "پسر", FEMALE: "دختر" };

const emptyForm = {
  role: "TEACHER", nationalId: "", firstName: "", lastName: "", fatherName: "", gender: "",
  birthDate: "", phone: "", shadNumber: "", education: "", fieldOfStudy: "", jobTitle: "", staffCode: "",
  homePhone: "", email: "", address: "", postalCode: "", birthPlace: "",
  permissions: [] as string[],
  forceInvalidNationalId: false,
};

export default function UsersPage() {
  const { t } = useLang();
  const confirm = useConfirm();
  const params = useSearchParams();
  const { data: me } = useApi<Me>("/api/auth/me");
  const [role, setRole] = useState<string>(params.get("role") ?? "");
  const [q, setQ] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [credResult, setCredResult] = useState<{ password: string; shadDelivery: { ok: boolean; error?: string }; nationalId: string; name: string } | null>(null);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editSchool, setEditSchool] = useState<string>("");
  const [editRole, setEditRole] = useState<string>("");
  const [editActive, setEditActive] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [permFilter, setPermFilter] = useState("");

  const isService = me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN";
  const isSuper = me?.user.role === "SUPER_ADMIN";

  /* راند ۱۸: ماژول‌های اختیاری مدرسهٔ مؤثر — شاد و سرایدار */
  const effSchool = me?.user.actingSchool ?? me?.user.school ?? null;
  const shadVisible = effSchool ? (effSchool as { shadEnabled?: boolean }).shadEnabled !== false : true;
  const custodianAvailable = effSchool ? (effSchool as { custodianEnabled?: boolean }).custodianEnabled !== false : true;

  /** کپی سریع متن با بازخورد */
  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} ${t("students.toast.copied")}`);
    } catch {
      toast.error(t("users.toast.copyFailed"));
    }
  }
  const inSchoolPanel = !!me?.user.actingSchool;

  const tabs = useMemo(() => {
    if (isService) {
      return [
        { value: "", label: t("common.all") },
        { value: "ADMIN", label: t("users.filter.serviceAdmins") },
        { value: "MANAGER", label: t("users.filter.schoolManagers") },
        { value: "DEPUTY", label: t("users.filter.deputies") },
        { value: "TEACHER", label: t("dashboard.teachers") },
        { value: "PARENT", label: t("students.parents.title") },
      ];
    }
    return [
      { value: "", label: t("common.all") },
      { value: "DEPUTY", label: t("users.filter.deputies") },
      { value: "TEACHER", label: t("dashboard.teachers") },
      { value: "PARENT", label: t("students.parents.title") },
    ];
  }, [isService]);

  const url = `/api/users?${role ? `role=${role}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}${includeInactive ? "includeInactive=1&" : ""}`;
  const { data, loading, error, refetch } = useApi<{ users: UserRow[] }>(url, [role, q, includeInactive]);
  const { data: schoolsData } = useApi<{ schools: Array<{ id: string; name: string }> }>(
    isService ? "/api/schools" : null
  );

  function set(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function togglePerm(key: string, target: "create" | "edit") {
    if (target === "create") {
      setForm((f) => ({
        ...f,
        permissions: f.permissions.includes(key) ? f.permissions.filter((p) => p !== key) : [...f.permissions, key],
      }));
    } else {
      setEditPerms((ps) => (ps.includes(key) ? ps.filter((x) => x !== key) : [...ps, key]));
    }
  }

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiPost<{ password: string; shadDelivery: { ok: boolean; error?: string }; user: { nationalId: string; firstName: string; lastName: string } }>(
        "/api/users",
        {
          ...form,
          nationalId: enDigits(form.nationalId),
          shadNumber: enDigits(form.shadNumber),
          phone: enDigits(form.phone),
          homePhone: enDigits(form.homePhone),
          postalCode: enDigits(form.postalCode),
        }
      );
      toast.success(t("users.toast.created"));
      setCredResult({ password: res.password, shadDelivery: res.shadDelivery, nationalId: res.user.nationalId, name: `${res.user.firstName} ${res.user.lastName}` });
      setShowCreate(false);
      setForm(emptyForm);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.toast.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function resetPassword(u: UserRow) {
    setResetting(true);
    try {
      const res = await apiPatch<{ password: string | null; shadDelivery: { ok: boolean; error?: string } }>(`/api/users/${u.id}`, { resetPassword: true });
      toast.success(res.password ? t("users.toast.passwordCreated") : t("common.errorShort"));
      setCredResult({
        password: res.password ?? "—",
        shadDelivery: res.shadDelivery,
        nationalId: u.nationalId,
        name: `${u.firstName} ${u.lastName}`,
      });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setResetting(false);
    }
  }

  async function deactivate(u: UserRow) {
    if (!(await confirm({ title: t("users.deactivate.title"), description: `${t("users.deactivate.descAccount")} «${u.firstName} ${u.lastName}» ${t("users.deactivate.descAsk")}`, confirmLabel: t("students.row.deactivate"), danger: true }))) return;
    try {
      await apiDelete(`/api/users/${u.id}`);
      toast.success(t("users.toast.deactivated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function activate(u: UserRow) {
    try {
      await apiPatch(`/api/users/${u.id}`, { isActive: true });
      toast.success(t("users.toast.activated"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  async function hardDelete(u: UserRow) {
    if (!(await confirm({ title: t("users.delete.title"), description: <>{t("users.delete.descPrefix")} «{u.firstName} {u.lastName}» {t("users.delete.descSuffix")}<br />{t("users.delete.descWarning")}</>, confirmLabel: t("users.delete.descPrefix"), danger: true }))) return;
    if (!(await confirm({ title: t("users.delete.finalTitle"), description: t("users.delete.finalDesc"), confirmLabel: t("users.delete.confirmYes"), danger: true }))) return;
    try {
      await apiDelete(`/api/users/${u.id}?mode=hard`);
      toast.success(t("users.toast.deletedFull"));
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    }
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setEditForm({
      nationalId: u.nationalId,
      firstName: u.firstName, lastName: u.lastName, fatherName: u.fatherName ?? "", gender: u.gender ?? "",
      phone: u.phone ?? "", homePhone: u.homePhone ?? "", shadNumber: u.shadNumber ?? "", email: u.email ?? "",
      education: u.education ?? "", fieldOfStudy: u.fieldOfStudy ?? "", jobTitle: u.jobTitle ?? "",
      staffCode: u.staffCode ?? "", address: u.address ?? "", postalCode: u.postalCode ?? "",
      birthPlace: u.birthPlace ?? "", birthDate: u.birthDate ?? "",
    });
    setEditPerms(u.permissions);
    setEditSchool(u.schoolId ?? "");
    setEditRole(u.role);
    setEditActive(u.isActive);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await apiPatch(`/api/users/${editing.id}`, {
        nationalId: enDigits(editForm.nationalId),
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        fatherName: editForm.fatherName,
        gender: editForm.gender,
        birthDate: editForm.birthDate || null,
        birthPlace: editForm.birthPlace,
        phone: enDigits(editForm.phone),
        homePhone: enDigits(editForm.homePhone),
        shadNumber: enDigits(editForm.shadNumber),
        email: editForm.email,
        education: editForm.education,
        fieldOfStudy: editForm.fieldOfStudy,
        jobTitle: editForm.jobTitle,
        staffCode: editForm.staffCode,
        address: editForm.address,
        postalCode: enDigits(editForm.postalCode),
        permissions: editPerms,
        ...(isSuper || isService ? { role: editRole, schoolId: editSchool || null } : {}),
        isActive: editActive,
      });
      toast.success(t("students.toast.saved"));
      setEditing(null);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.errorShort"));
    } finally {
      setSaving(false);
    }
  }

  // فیلتر فیلدهای ویرایش بر اساس نقش هدف
  const editIsStaff = editing && ["MANAGER", "DEPUTY", "TEACHER"].includes(editRole);
  const editIsStudent = editing && editRole === "STUDENT";
  const editIsParent = editing && editRole === "PARENT";
  const editIsAdminRole = editing && editRole === "ADMIN";

  const filteredGroups = SERVICE_PERMISSION_GROUPS.filter(
    (g) => !permFilter || g.group.includes(permFilter) || g.items.some((i) => i.label.includes(permFilter))
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={inSchoolPanel ? t("users.title.schoolPanel") : isService ? t("users.title.service") : t("users.title.staff")}
        desc={t("users.header.desc")}
        action={
          <button
            className="b-btn b-btn-spring b-btn-sm"
            onClick={() => { setShowCreate(true); setCredResult(null); }}
          >
            <Plus className="w-4 h-4" /> {t("users.new")}
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="b-search-pill max-w-xs">
          <Search className="w-4 h-4 shrink-0" />
          <input className="b-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("users.search.placeholder")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.value}
              onClick={() => setRole(t.value)}
              className={`b-pill-tab ${role === t.value ? "b-pill-tab-active" : ""}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-steel ms-auto cursor-pointer">
          <input type="checkbox" className="accent-spring w-4 h-4" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          {t("users.showInactive")}
        </label>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.users.length === 0 && (
        <EmptyState title={t("users.empty.notFound")} desc={t("users.empty.hint")} />
      )}

      {data && data.users.length > 0 && (
        <div className="b-card-sm overflow-hidden">
          <div className="overflow-x-auto b-scroll">
            <table className="w-full text-[13px] b-rows-in">
              <thead>
                <tr className="border-b border-hairline-soft text-steel text-[11.5px]">
                  <th className="text-start py-3 px-4 font-bold">{t("users.table.user")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden md:table-cell">{t("users.table.role")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden lg:table-cell">{t("students.table.nationalId")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden lg:table-cell">{t("users.table.shadContact")}</th>
                  <th className="text-start py-3 px-4 font-bold hidden md:table-cell">{t("users.table.lastLogin")}</th>
                  <th className="text-start py-3 px-4 font-bold">{t("users.table.status")}</th>
                  <th className="text-start py-3 px-4 font-bold">{t("students.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id} className="b-row border-b border-hairline-soft/60 last:border-0">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          user={{
                            id: u.id, firstName: u.firstName, lastName: u.lastName,
                            profileImageType: u.profileImageType, photoUrl: u.photoUrl, avatar: u.avatar,
                          }}
                          size={36}
                        />
                        <span className="flex flex-col min-w-0">
                          <b className="truncate">{u.firstName} {u.lastName}</b>
                          <span className="text-[12px] text-steel truncate">
                            {u.role === "STUDENT"
                              ? `${t("common.student")} ${u.studentProfile?.class?.name ?? ""}`
                              : u.role === "PARENT"
                                ? u.parentOf?.[0]?.student
                                  ? `${t("role.parent")} ${u.parentOf[0].student.user.firstName} ${u.parentOf[0].student.user.lastName}`
                                  : t("role.parent")
                                : u.role === "ADMIN"
                                  ? `${t("role.admin")} · ${faDigits(u.permissions.length)} ${t("users.accessCount")}`
                                  : u.school?.name ?? u.jobTitle ?? u.education ?? ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell"><RoleBadge role={u.role} /></td>
                    <td className="py-3 px-4 hidden lg:table-cell"><span dir="ltr" className="font-mono text-[11.5px]">{u.nationalId}</span></td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      {u.shadNumber ? <span dir="ltr" className="font-mono text-[11.5px]">{u.shadNumber}</span> : <span className="text-stone text-[12px]">{t("users.notRegistered")}</span>}
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-steel text-[11.5px]">
                      {u.lastLoginAt ? relativeTimeFa(u.lastLoginAt) : t("users.noLogin")}
                      {u.mustChangePassword && <span className="b-badge b-badge-warning ms-1 !text-[9px] !px-1.5">{t("users.initialPassword")}</span>}
                    </td>
                    <td className="py-3 px-4"><StatusBadge ok={u.isActive} okLabel={t("common.active")} badLabel={t("common.inactive")} /></td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors"
                          onClick={() => resetPassword(u)}
                          title={t("users.row.resetPassword")}
                          disabled={resetting}
                        >
                          <KeyRound className="w-4 h-4" />
                        </button>
                        <button
                          className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors"
                          onClick={() => openEdit(u)}
                          title={t("users.row.editAll")}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {u.isActive ? (
                          <button
                            className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/10 hover:text-destructive transition-colors"
                            onClick={() => deactivate(u)}
                            title={t("students.row.deactivate")}
                          >
                            <UserRoundX className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-spring-tint hover:text-spring transition-colors"
                            onClick={() => activate(u)}
                            title={t("users.row.activate")}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                        {(isSuper || (me?.user.role === "ADMIN" && (me.user.permissions ?? []).includes("delete_users"))) && (
                          <button
                            className="w-8 h-8 rounded-full flex items-center justify-center text-steel hover:bg-destructive/15 hover:text-destructive transition-colors"
                            onClick={() => hardDelete(u)}
                            title={t("users.row.deleteFull")}
                          >
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

      {/* ───────── ساخت کاربر ───────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setShowCreate(false)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("users.create.title")}</h2>
            <p className="t-sm text-steel mb-6">{t("users.create.desc")}</p>
            <form onSubmit={createUser} className="flex flex-col gap-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("users.field.roleRequired")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.role}
                    onChange={(v) => set("role", v)}
                    options={
                      isSuper
                        ? [
                            { value: "ADMIN", label: t("users.role.adminFine") },
                            { value: "MANAGER", label: t("role.manager") },
                            { value: "DEPUTY", label: t("role.deputy") },
                            { value: "TEACHER", label: t("role.teacher") },
                            { value: "CUSTODIAN", label: t("role.custodian") },
                            { value: "PARENT", label: t("role.parent") },
                          ]
                        : isService
                        ? [
                            { value: "MANAGER", label: t("role.manager") },
                            { value: "DEPUTY", label: t("role.deputy") },
                            { value: "TEACHER", label: t("role.teacher") },
                            { value: "CUSTODIAN", label: t("role.custodian") },
                            { value: "PARENT", label: t("role.parent") },
                          ]
                        : me?.user.role === "MANAGER"
                        ? [
                            { value: "DEPUTY", label: t("role.deputy") },
                            { value: "TEACHER", label: t("role.teacher") },
                            { value: "CUSTODIAN", label: t("role.custodian") },
                            { value: "PARENT", label: t("role.parent") },
                          ]
                        : [
                            { value: "TEACHER", label: t("role.teacher") },
                            { value: "PARENT", label: t("role.parent") },
                          ]
                    }
                  />
                  {form.role === "CUSTODIAN" && !custodianAvailable && (
                    <span className="text-[10.5px] text-warning-deep">{t("users.custodianDisabledNote")}</span>
                  )}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold flex items-center gap-1.5">
                    <IdCard className="w-3.5 h-3.5" /> {t("students.field.nationalIdUser")}
                  </span>
                  <input className="b-input" dir="ltr" inputMode="numeric" value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} required placeholder={t("students.ph.nationalId")} />
                  {isSuper && (
                    <label className="flex items-center gap-2 text-[12px] text-steel mt-1 cursor-pointer">
                      <input type="checkbox" className="accent-spring w-4 h-4" checked={form.forceInvalidNationalId} onChange={(e) => set("forceInvalidNationalId", e.target.checked)} />
                      {t("users.invalidNationalIdRegister")}
                    </label>
                  )}
                  {!isSuper && <span className="text-[10.5px] text-stone">{t("users.nationalIdAlgorithmNote")}</span>}
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.firstName")}</span>
                  <input className="b-input" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.lastName")}</span>
                  <input className="b-input" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} required />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.fatherName")}</span>
                  <input className="b-input" value={form.fatherName} onChange={(e) => set("fatherName", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.gender")}</span>
                  <Select
                    className="w-full"
                    buttonClassName="!w-full"
                    value={form.gender}
                    onChange={(v) => set("gender", v)}
                    options={[{ value: "", label: t("users.selectPlaceholder") }, { value: "MALE", label: t("users.gender.maleFull") }, { value: "FEMALE", label: t("users.gender.femaleFull") }]}
                    placeholder={t("users.selectPlaceholder")}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("users.field.birthDateJalali")}</span>
                  <JalaliDateInput value={form.birthDate ? form.birthDate : null} onChange={(d) => set("birthDate", d ? d.toISOString() : "")} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.birthPlace")}</span>
                  <input className="b-input" value={form.birthPlace} onChange={(e) => set("birthPlace", e.target.value)} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("students.field.mobile")}</span>
                  <input className="b-input" dir="ltr" inputMode="numeric" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="09…" />
                </label>
                {shadVisible && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("students.field.shadNumber")}</span>
                    <input className="b-input" dir="ltr" inputMode="numeric" value={form.shadNumber} onChange={(e) => set("shadNumber", e.target.value)} placeholder="09…" />
                    <span className="text-[10.5px] text-stone">{t("users.shadNote")}</span>
                  </label>
                )}
                {(form.role === "TEACHER" || form.role === "DEPUTY") && (
                  <>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-bold">{t("users.field.education")}</span>
                      <input className="b-input" value={form.education} onChange={(e) => set("education", e.target.value)} placeholder={t("users.ph.education")} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-[12.5px] font-bold">{t("users.field.staffCode")}</span>
                      <input className="b-input" dir="ltr" value={form.staffCode} onChange={(e) => set("staffCode", e.target.value)} />
                    </label>
                  </>
                )}
                {form.role === "PARENT" && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("students.parent.job")}</span>
                    <input className="b-input" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} placeholder={t("users.ph.job")} />
                  </label>
                )}
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">{t("students.field.address")}</span>
                  <input className="b-input" value={form.address} onChange={(e) => set("address", e.target.value)} />
                </label>
              </div>

              {(form.role === "DEPUTY" || form.role === "TEACHER") && (
                <div className="b-card-sm !rounded-2xl p-5">
                  <h3 className="font-bold text-[13.5px] flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-spring" /> {t("users.perms.title")} {ROLE_TKEY[form.role] ? t(ROLE_TKEY[form.role]) : form.role}
                  </h3>
                  <p className="t-cap text-stone mb-4">{t("users.perms.managerNote")}</p>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {PERMISSION_CATALOG.map((p) => (
                      <label key={p.key} className={`b-option flex items-center gap-3 !py-2.5 ${form.permissions.includes(p.key) ? "b-option-selected" : ""}`}>
                        <input
                          type="checkbox"
                          className="accent-spring w-4 h-4"
                          checked={form.permissions.includes(p.key)}
                          onChange={() => togglePerm(p.key, "create")}
                        />
                        <span className="flex flex-col">
                          <b className="text-[12.5px]">{p.label}</b>
                          <span className="text-[10.5px] text-steel">{p.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {form.role === "ADMIN" && isSuper && (
                <div className="b-card-sm !rounded-2xl p-5">
                  <h3 className="font-bold text-[13.5px] flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-spring" /> {t("users.perms.adminFine")}
                  </h3>
                  <p className="t-cap text-stone mb-3">{t("users.perms.rangeNote")}</p>
                  <div className="b-search-pill mb-3 max-w-xs">
                    <Search className="w-4 h-4" />
                    <input className="b-input" value={permFilter} onChange={(e) => setPermFilter(e.target.value)} placeholder={t("users.perms.searchPlaceholder")} />
                  </div>
                  <div className="flex flex-col gap-4">
                    {filteredGroups.length === 0 ? (<p className="text-[12px] text-steel">{t("users.perms.noMatch")}</p>) : filteredGroups.map((g) => (
                      <div key={g.group} className="border border-hairline-soft rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-1">
                          <b className="text-[12.5px]">{g.group}</b>
                          <div className="flex items-center gap-2">
                            <button type="button" className="b-btn b-btn-ghost text-[10.5px] text-spring font-bold hover:underline" onClick={() => g.items.forEach((i) => { if (!form.permissions.includes(i.key)) togglePerm(i.key, "create"); })}>
                              {t("students.table.selectAll")}
                            </button>
                            <button type="button" className="b-btn b-btn-ghost text-[10.5px] text-steel hover:underline" onClick={() => g.items.forEach((i) => { if (form.permissions.includes(i.key)) togglePerm(i.key, "create"); })}>
                              {t("users.perms.none")}
                            </button>
                          </div>
                        </div>
                        <p className="text-[10.5px] text-stone mb-3">{g.desc}</p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {g.items.map((i) => (
                            <label key={i.key} className={`b-option flex items-center gap-3 !py-2 ${form.permissions.includes(i.key) ? "b-option-selected" : ""}`}>
                              <input
                                type="checkbox"
                                className="accent-spring w-4 h-4"
                                checked={form.permissions.includes(i.key)}
                                onChange={() => togglePerm(i.key, "create")}
                              />
                              <span className="flex flex-col">
                                <b className="text-[12px]">{i.label}</b>
                                <span className="text-[12px] text-steel">{i.desc}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("users.create.submit")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setShowCreate(false)} disabled={saving}>
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────── ویرایش کامل ───────── */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-deep/40" onClick={() => !saving && setEditing(null)} aria-hidden />
          <div className="relative b-card p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto b-scroll b-pop">
            <h2 className="font-bold text-lg mb-1">{t("users.edit.titlePrefix")} {editing.firstName} {editing.lastName}</h2>
            <p className="t-sm text-steel mb-6"><span dir="ltr" className="font-mono">{editing.nationalId}</span> · {ROLE_TKEY[editing.role] ? t(ROLE_TKEY[editing.role]) : editing.role} · {t("users.edit.memberSince")} {formatDateFa(editing.createdAt)}</p>
            <form onSubmit={saveEdit} className="flex flex-col gap-4">
              {(isSuper || isService) && (
                <div className="b-card-sm !rounded-2xl p-4 grid sm:grid-cols-3 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("users.field.role")}</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={editRole}
                      onChange={(v) => setEditRole(v)}
                      disabled={!isSuper && editing.role === "ADMIN"}
                      options={[
                        ...(isSuper ? [{ value: "ADMIN", label: t("role.admin") }] : []),
                        { value: "MANAGER", label: t("role.manager") },
                        { value: "DEPUTY", label: t("role.deputy") },
                        { value: "TEACHER", label: t("role.teacher") },
                        { value: "CUSTODIAN", label: t("role.custodian") },
                        { value: "STUDENT", label: t("common.student") },
                        { value: "PARENT", label: t("role.parent") },
                      ]}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {t("users.field.school")}</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={editSchool}
                      onChange={(v) => setEditSchool(v)}
                      options={[{ value: "", label: t("users.noSchoolDash") }, ...(schoolsData?.schools ?? []).map((s2) => ({ value: s2.id, label: s2.name }))]}
                      placeholder={t("users.noSchoolDash")}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{t("users.field.accountStatus")}</span>
                    <Select
                      className="w-full"
                      buttonClassName="!w-full"
                      value={editActive ? "1" : "0"}
                      onChange={(v) => setEditActive(v === "1")}
                      options={[{ value: "1", label: t("common.active") }, { value: "0", label: t("common.inactive") }]}
                    />
                  </label>
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                {(isSuper || isService) && (
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold flex items-center gap-1"><IdCard className="w-3.5 h-3.5" /> {t("students.detail.nationalId")}</span>
                    <input
                      className="b-input"
                      dir="ltr"
                      inputMode="numeric"
                      value={editForm.nationalId ?? ""}
                      onChange={(e) => setEditForm((ef) => ({ ...ef, nationalId: e.target.value }))}
                    />
                    <span className="text-[10.5px] text-stone">{t("users.nationalIdChangeNote")}</span>
                  </label>
                )}
                {[
                  { k: "firstName", l: t("students.ph.firstName"), rtl: true }, { k: "lastName", l: t("students.ph.lastName"), rtl: true },
                  { k: "fatherName", l: t("students.field.fatherName"), rtl: true }, { k: "phone", l: t("students.field.mobile"), rtl: false },
                  { k: "shadNumber", l: t("students.field.shadNumber"), rtl: false }, { k: "homePhone", l: t("users.field.homePhone"), rtl: false },
                  { k: "email", l: t("users.field.email"), rtl: false }, { k: "birthPlace", l: t("students.field.birthPlace"), rtl: true },
                  { k: "education", l: t("users.field.education"), rtl: true }, { k: "fieldOfStudy", l: t("users.field.fieldOfStudy"), rtl: true },
                  { k: "jobTitle", l: t("students.parent.job"), rtl: true }, { k: "staffCode", l: t("users.field.staffCode"), rtl: false },
                  { k: "postalCode", l: t("users.field.postalCode"), rtl: false },
                ].map((f) => (
                  <label key={f.k} className="flex flex-col gap-1.5">
                    <span className="text-[12.5px] font-bold">{f.l}</span>
                    <input
                      className="b-input"
                      dir={f.rtl ? "rtl" : "ltr"}
                      value={editForm[f.k] ?? ""}
                      onChange={(e) => setEditForm((ef) => ({ ...ef, [f.k]: e.target.value }))}
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12.5px] font-bold">{t("users.field.birthDateJalali")}</span>
                  <JalaliDateInput
                    value={editForm.birthDate || null}
                    onChange={(d) => setEditForm((ef) => ({ ...ef, birthDate: d ? d.toISOString() : "" }))}
                  />
                </label>
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <span className="text-[12.5px] font-bold">{t("students.field.address")}</span>
                  <input className="b-input" value={editForm.address ?? ""} onChange={(e) => setEditForm((ef) => ({ ...ef, address: e.target.value }))} />
                </label>
              </div>

              {(editIsStaff && (editing.role === "DEPUTY" || editing.role === "TEACHER")) && (
                <div className="b-card-sm !rounded-2xl p-5">
                  <h3 className="font-bold text-[13.5px] mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-spring" /> {t("users.perms.school")}
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {PERMISSION_CATALOG.map((p) => (
                      <label key={p.key} className={`b-option flex items-center gap-3 !py-2.5 ${editPerms.includes(p.key) ? "b-option-selected" : ""}`}>
                        <input
                          type="checkbox"
                          className="accent-spring w-4 h-4"
                          checked={editPerms.includes(p.key)}
                          onChange={() => togglePerm(p.key, "edit")}
                        />
                        <span className="flex flex-col">
                          <b className="text-[12.5px]">{p.label}</b>
                          <span className="text-[10.5px] text-steel">{p.desc}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {editIsAdminRole && isSuper && (
                <div className="b-card-sm !rounded-2xl p-5">
                  <h3 className="font-bold text-[13.5px] mb-3 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-spring" /> {t("users.perms.adminFine")}
                    <span className="b-badge b-badge-soft ms-2">{faDigits(editPerms.length)} {t("common.active")}</span>
                  </h3>
                  <div className="flex flex-col gap-4">
                    {filteredGroups.length === 0 ? (<p className="text-[12px] text-steel">{t("users.perms.noMatch")}</p>) : filteredGroups.map((g) => (
                      <div key={g.group}>
                        <div className="flex items-center justify-between mb-2">
                          <b className="text-[12px]">{g.group}</b>
                          <div className="flex items-center gap-2">
                            <button type="button" className="b-btn b-btn-ghost text-[10.5px] text-spring font-bold" onClick={() => g.items.forEach((i) => { if (!editPerms.includes(i.key)) setEditPerms((ps) => [...ps, i.key]); })}>
                              {t("common.all")}
                            </button>
                            <button type="button" className="b-btn b-btn-ghost text-[10.5px] text-steel" onClick={() => setEditPerms((ps) => ps.filter((x) => !g.items.some((i) => i.key === x)))}>
                              {t("users.perms.none")}
                            </button>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {g.items.map((i) => (
                            <label key={i.key} className={`b-option flex items-center gap-3 !py-2 ${editPerms.includes(i.key) ? "b-option-selected" : ""}`}>
                              <input type="checkbox" className="accent-spring w-4 h-4" checked={editPerms.includes(i.key)} onChange={() => togglePerm(i.key, "edit")} />
                              <b className="text-[12px]">{i.label}</b>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button type="submit" disabled={saving} className="b-btn b-btn-spring">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : t("users.edit.saveAll")}
                </button>
                <button type="button" className="b-btn b-btn-ghost" onClick={() => setEditing(null)}>{t("common.close")}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────── اعتبارنامه — راند ۱۸: کپی سریع جایگزین/مکمل شاد ───────── */}
      {credResult && (
        <div className="fixed bottom-4 left-4 right-4 lg:start-auto lg:end-6 z-50 b-card-md !rounded-2xl b-shadow-rail p-5 b-pop max-w-md">
          <h4 className="font-bold text-[13.5px] flex items-center gap-2 mb-3">
            <Send className="w-4 h-4 text-spring" /> {t("students.cred.title")} {credResult.name}
          </h4>
          <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 text-[12.5px] items-center">
            <span className="text-steel">{t("students.cred.username")}</span>
            <b dir="ltr" className="font-mono truncate">{credResult.nationalId}</b>
            <button
              onClick={() => copyText(credResult.nationalId, t("users.cred.usernameLabel"))}
              className="b-btn b-btn-ghost !min-h-0 !p-1.5 shrink-0"
              title={t("users.cred.copyUsername")}
              aria-label={t("users.cred.copyUsername")}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            <span className="text-steel">{t("users.cred.randomPassword")}</span>
            <b dir="ltr" className="font-mono truncate">{credResult.password}</b>
            <button
              onClick={() => copyText(credResult.password, t("users.cred.passwordLabel"))}
              className="b-btn b-btn-ghost !min-h-0 !p-1.5 shrink-0"
              title={t("users.cred.copyPassword")}
              aria-label={t("users.cred.copyPassword")}
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            className="b-btn b-btn-soft b-btn-sm mt-3 w-full"
            onClick={() => copyText(`${t("students.cred.username")} ${credResult.nationalId}\n${t("users.cred.passwordFull")} ${credResult.password}\n${t("students.cred.firstLoginNote")}`, t("users.cred.full"))}
          >
            <Copy className="w-3.5 h-3.5" /> {t("users.cred.copyFull")}
          </button>
          <p className="t-sm mt-3 text-spring-deep dark:text-spring-soft">
            {credResult.shadDelivery.ok
              ? t("users.cred.sentViaShad")
              : credResult.shadDelivery.error === "SHAD_DISABLED"
                ? t("users.cred.shadOff")
                : credResult.shadDelivery.error === "NO_SHAD_NUMBER"
                  ? t("users.cred.noShadNumber")
                  : t("users.cred.sendFailed")}
          </p>
          <button className="b-btn b-btn-soft b-btn-sm mt-3" onClick={() => setCredResult(null)}>{t("students.cred.acknowledged")}</button>
        </div>
      )}
    </div>
  );
}
