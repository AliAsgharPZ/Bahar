"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellRing, Pin, Trash2, Loader2, MapPin, Send, Users, Globe2, Eye } from "lucide-react";
import { useApi, apiPost, apiDelete, apiPatch } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { IranMapPicker, type RegionSelection } from "@/components/shared/iran-map-picker";
import { useConfirm } from "@/components/shared/pickers";
import { formatDateTimeFa, relativeTimeFa, faDigits } from "@/lib/persian";

type Announcement = {
  id: string;
  scope: string;
  schoolId: string | null;
  title: string;
  body: string;
  audienceRoles: string[];
  targetProvinces: string[];
  targetCounties: string[];
  pinned: boolean;
  createdAt: string;
  school: { id: string; name: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
};

type Me = {
  user: {
    role: string;
    permissions: string[];
    school: { id: string; name: string } | null;
    actingSchool: { id: string; name: string } | null;
  };
};

const ROLE_TARGETS: { value: string; label: string }[] = [
  { value: "MANAGERS", label: "مدیران مدارس" },
  { value: "TEACHERS", label: "معلمان و معاونین" },
  { value: "STUDENTS", label: "دانش‌آموزان" },
  { value: "PARENTS", label: "اولیا" },
];

const ROLE_TARGET_LABELS: Record<string, string> = {
  MANAGERS: "مدیران", TEACHERS: "معلمان", STUDENTS: "دانش‌آموزان", PARENTS: "اولیا",
};

const emptyForm = {
  title: "",
  body: "",
  pinned: false,
  scope: "SCHOOL" as "SCHOOL" | "PLATFORM",
  audienceRoles: [] as string[],
};

export default function AnnouncementsPage() {
  const { data: me } = useApi<Me>("/api/auth/me");
  const { data, loading, error, refetch } = useApi<{ announcements: Announcement[] }>("/api/announcements");
  const confirm = useConfirm();
  const [form, setForm] = useState(emptyForm);
  const [region, setRegion] = useState<RegionSelection>({ provinces: [], counties: [] });
  const [mapOpen, setMapOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSend =
    me?.user.role === "MANAGER" ||
    me?.user.role === "SUPER_ADMIN" ||
    (me?.user.role === "ADMIN" && (me.user.permissions.includes("platform_announcements") || me.user.permissions.includes("enter_school_panel") || me.user.actingSchool)) ||
    (me?.user.permissions.includes("manage_announcements"));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost("/api/announcements", {
        ...form,
        audienceRoles: form.audienceRoles,
        targetProvinces: region.provinces,
        targetCounties: region.counties,
      });
      toast.success("اطلاعیه ارسال شد.");
      setForm(emptyForm);
      setRegion({ provinces: [], counties: [] });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    } finally {
      setSaving(false);
    }
  }

  async function remove(a: Announcement) {
    if (!(await confirm({ title: "حذف اطلاعیه", description: `اطلاعیه «${a.title}» حذف شود؟`, confirmLabel: "حذف", danger: true }))) return;
    try {
      await apiDelete(`/api/announcements/${a.id}`);
      toast.success("حذف شد.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  async function togglePin(a: Announcement) {
    try {
      await apiPatch(`/api/announcements/${a.id}`, { pinned: !a.pinned });
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "خطا");
    }
  }

  // رسید خواندن: بازشدن این صفحه یعنی اطلاعیه‌ها دیده شده‌اند
  const markedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of data?.announcements ?? []) {
      if (markedRef.current.has(a.id)) continue;
      markedRef.current.add(a.id);
      fetch(`/api/announcements/${a.id}/read`, { method: "POST", credentials: "include" }).catch(() => {});
    }
  }, [data]);

  const [readStats, setReadStats] = useState<Record<string, { count: number; readers: { name: string; role: string }[] }>>({});
  const [readOpen, setReadOpen] = useState<string | null>(null);
  async function toggleReaders(a: Announcement) {
    if (readOpen === a.id) { setReadOpen(null); return; }
    setReadOpen(a.id);
    if (!readStats[a.id]) {
      const res = await fetch(`/api/announcements/${a.id}/read`, { credentials: "include" }).then((x) => x.json()).catch(() => null);
      if (res?.ok) setReadStats((s) => ({ ...s, [a.id]: { count: res.count, readers: res.readers } }));
    }
  }

  const isService = me?.user.role === "SUPER_ADMIN" || me?.user.role === "ADMIN";
  const hasPlatform = isService && (me?.user.role === "SUPER_ADMIN" || me?.user.permissions.includes("platform_announcements"));

  function regionBadge(a: Announcement) {
    if (a.targetCounties.length > 0) {
      return `${faDigits(a.targetCounties.length)} شهرستان`;
    }
    if (a.targetProvinces.length > 0) {
      return `${faDigits(a.targetProvinces.length)} استان`;
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="اطلاعیه‌ها"
        desc="اطلاعیه‌های مدرسه و سراسری — با هدف‌گیری نوع کاربر و نقشه ایران (قابل ترکیب)."
      />

      {canSend && (
        <form onSubmit={send} className="b-card p-5 md:p-6 flex flex-col gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <b className="text-[13.5px] flex items-center gap-2"><BellRing className="w-4 h-4 text-spring" /> ارسال اطلاعیه جدید</b>
            {hasPlatform && (
              <div className="flex items-center gap-2 ms-auto">
                <button
                  type="button"
                  className={`b-pill-tab !text-[11px] ${form.scope === "SCHOOL" ? "b-pill-tab-active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, scope: "SCHOOL" }))}
                >
                  مدرسه
                </button>
                <button
                  type="button"
                  className={`b-pill-tab !text-[11px] ${form.scope === "PLATFORM" ? "b-pill-tab-active" : ""}`}
                  onClick={() => setForm((f) => ({ ...f, scope: "PLATFORM" }))}
                >
                  <Globe2 className="w-3 h-3 inline ml-1" /> سراسری (همه مدارس)
                </button>
              </div>
            )}
          </div>

          <input
            className="b-input"
            placeholder="عنوان اطلاعیه…"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
          />
          <textarea
            rows={3}
            className="b-input !rounded-2xl resize-none"
            placeholder="متن اطلاعیه (حداکثر ۶۰۰ نویسه)…"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            required
            maxLength={600}
          />

          <div className="grid md:grid-cols-2 gap-4">
            {/* هدف‌گیری نوع کاربر */}
            <div>
              <b className="text-[12px] flex items-center gap-1.5 mb-2">
                <Users className="w-3.5 h-3.5 text-spring" /> ارسال به چه کسانی؟ (خالی = همه)
              </b>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_TARGETS.map((r) => {
                  const checked = form.audienceRoles.includes(r.value);
                  return (
                    <label key={r.value} className={`b-option !py-2.5 ${checked ? "b-option-selected" : ""}`}>
                      <input
                        type="checkbox"
                        className="accent-[#00825e] w-4 h-4"
                        checked={checked}
                        onChange={() =>
                          setForm((f) => ({
                            ...f,
                            audienceRoles: checked ? f.audienceRoles.filter((x) => x !== r.value) : [...f.audienceRoles, r.value],
                          }))
                        }
                      />
                      <b className="text-[12px]">{r.label}</b>
                    </label>
                  );
                })}
              </div>
              <p className="text-[10.5px] text-stone mt-1.5">چند نوع کاربر را می‌توانید همزمان انتخاب کنید.</p>
            </div>

            {/* هدف‌گیری نقشه */}
            <div>
              <b className="text-[12px] flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5 text-spring" /> محدوده جغرافیایی (اختیاری)
              </b>
              <button
                type="button"
                className="b-btn b-btn-ghost b-input flex items-center justify-between gap-2"
                onClick={() => setMapOpen(true)}
              >
                <span className="text-[13px]">
                  {region.provinces.length || region.counties.length
                    ? `${region.provinces.length ? `${faDigits(region.provinces.length)} استان` : ""}${region.provinces.length && region.counties.length ? " + " : ""}${region.counties.length ? `${faDigits(region.counties.length)} شهرستان` : ""}`
                    : "همه ایران (بدون محدودیت)"}
                </span>
                <MapPin className="w-4 h-4 text-spring shrink-0" />
              </button>
              <p className="text-[10.5px] text-stone mt-1.5">
                با انتخاب نوع کاربر + نقشه، هر دو فیلتر هم‌زمان اعمال می‌شوند (ترکیب AND).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <label className="b-option !py-2.5">
              <input
                type="checkbox"
                className="accent-[#00825e] w-4 h-4"
                checked={form.pinned}
                onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
              />
              <b className="text-[12px] flex items-center gap-1"><Pin className="w-3.5 h-3.5" /> سنجاق در بالا</b>
            </label>
            <button type="submit" disabled={saving} className="b-btn b-btn-spring ms-auto">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 flip-rtl" />} ارسال
            </button>
          </div>
        </form>
      )}

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && data.announcements.length === 0 && (
        <EmptyState icon={BellRing} title="اطلاعیه‌ای نیست" desc="اطلاعیه‌های مدرسه و سراسری اینجا نمایش داده می‌شوند." />
      )}

      <div className="flex flex-col gap-3">
        {(data?.announcements ?? []).map((a) => {
          const reg = regionBadge(a);
          return (
            <div key={a.id} className={`b-card-sm p-5 ${a.pinned ? "!border-spring/40 !bg-spring-tint/30" : ""}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {a.pinned && <Pin className="w-3.5 h-3.5 text-spring shrink-0" />}
                {a.scope === "PLATFORM" && (
                  <span className="b-badge b-badge-soft !text-[10px]">
                    <Globe2 className="w-3 h-3 inline ml-0.5" /> سراسری
                  </span>
                )}
                {a.audienceRoles.length > 0 ? (
                  a.audienceRoles.map((r) => (
                    <span key={r} className="b-badge b-badge-neutral !text-[10px]">{ROLE_TARGET_LABELS[r] ?? r}</span>
                  ))
                ) : (
                  <span className="b-badge b-badge-neutral !text-[10px]">همه</span>
                )}
                {reg && (
                  <span className="b-badge b-badge-soft !text-[10px]">
                    <MapPin className="w-3 h-3 inline ml-0.5" /> {reg}
                  </span>
                )}
                <span className="text-[10.5px] text-stone ms-auto">{a.school?.name ?? ""} · {relativeTimeFa(a.createdAt)}</span>
              </div>
              <b className="text-[14px] block mb-1.5">{a.title}</b>
              <p className="text-[13px] text-steel leading-relaxed whitespace-pre-line">{a.body}</p>
              <div className="flex items-center gap-3 mt-3 pt-2 border-t border-hairline-soft/60">
                <span className="text-[10.5px] text-stone">
                  {a.createdBy ? `${a.createdBy.firstName} ${a.createdBy.lastName}` : "سیستم"} · {formatDateTimeFa(a.createdAt)}
                </span>
                {canSend && (
                  <div className="ms-auto flex items-center gap-1">
                    <button className="b-btn b-btn-ghost b-btn-sm !text-steel !p-0 !w-8 !min-w-8" onClick={() => toggleReaders(a)} title="چه کسانی خوانده‌اند؟">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button className="b-btn b-btn-ghost b-btn-sm !text-steel !p-0 !w-8 !min-w-8" onClick={() => togglePin(a)} title={a.pinned ? "برداشتن سنجاق" : "سنجاق"}>
                      <Pin className={`w-3.5 h-3.5 ${a.pinned ? "text-spring" : ""}`} />
                    </button>
                    <button className="b-btn b-btn-ghost b-btn-sm !text-destructive !p-0 !w-8 !min-w-8" onClick={() => remove(a)} title="حذف">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              {canSend && readOpen === a.id && (
                <div className="mt-3 rounded-xl bg-cloud p-3 text-[12px]">
                  {readStats[a.id] ? (
                    <>
                      <b>{faDigits(readStats[a.id].count)} نفر خوانده‌اند</b>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {readStats[a.id].readers.slice(0, 40).map((r, i) => (
                          <span key={i} className="b-badge b-badge-neutral !text-[10px]">{r.name}</span>
                        ))}
                        {readStats[a.id].readers.length === 0 && <span className="text-steel">هنوز کسی نخوانده است.</span>}
                      </div>
                    </>
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <IranMapPicker
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        selection={region}
        onChange={setRegion}
        title="هدف‌گیری جغرافیایی اطلاعیه"
        desc="اختیاری — انتخاب خالی یعنی همه مدارس ایران. با فیلتر نوع کاربر ترکیب می‌شود."
      />
    </div>
  );
}
