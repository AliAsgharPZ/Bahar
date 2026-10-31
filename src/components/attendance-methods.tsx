"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  QrCode, Keyboard, MonitorSmartphone, Plug, ScanLine, KeyRound, Copy, Trash2,
  Plus, Loader2, Camera, CameraOff, ClipboardCheck, Fingerprint, Video, Nfc, DoorOpen, Settings2,
} from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useApi, apiPost } from "@/lib/client";
import { Select } from "@/components/shared/pickers";
import { faNumber, todayJalali } from "@/lib/persian";

type Settings = { qrEnabled: boolean; codeEnabled: boolean; kioskEnabled: boolean; externalEnabled: boolean };
type KeyRow = { id: string; name: string; method: string; isActive: boolean; lastUsedAt: string | null; createdAt: string };
type SettingsResp = { settings: Settings; keys: KeyRow[]; canManage: boolean };

const METHOD_ICONS: Record<string, typeof Fingerprint> = {
  FACE: Fingerprint, CCTV: Video, NFC: Nfc, GATE: DoorOpen, OTHER: Plug,
};

/* ═══════════════ پنل کارکنان: تنظیمات روش‌ها + کد کلاس + اسکن + کلیدهای اتصال ═══════════════ */
export function AttendanceMethodsPanel({ classId }: { classId: string }) {
  const { t } = useLang();
  const { data, refetch } = useApi<SettingsResp>("/api/attendance/settings");
  const [draft, setDraft] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const settings = draft ?? data?.settings ?? null;
  const canManage = !!data?.canManage;

  const setFlag = (k: keyof Settings, v: boolean) => {
    if (!settings) return;
    setDraft({ ...settings, [k]: v });
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error();
      toast.success(t("attendance.m.settingsSaved"));
      setDraft(null);
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  };

  if (!data || !settings) return null;

  const rows: Array<{ key: keyof Settings; icon: typeof QrCode; title: string; desc: string }> = [
    { key: "qrEnabled", icon: QrCode, title: t("attendance.m.qr"), desc: t("attendance.m.qrDesc") },
    { key: "codeEnabled", icon: Keyboard, title: t("attendance.m.code"), desc: t("attendance.m.codeDesc") },
    { key: "kioskEnabled", icon: MonitorSmartphone, title: t("attendance.m.kiosk"), desc: t("attendance.m.kioskDesc") },
    { key: "externalEnabled", icon: Plug, title: t("attendance.m.external"), desc: t("attendance.m.externalDesc") },
  ];

  return (
    <div className="b-card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-spring" />
        <h3 className="font-bold text-[15px]">{t("attendance.m.title")}</h3>
      </div>
      <p className="text-[13px] text-steel leading-6">{t("attendance.m.desc")}</p>

      <div className="flex flex-col gap-2.5">
        <div className="b-card-sm p-3.5 flex items-center gap-3">
          <ClipboardCheck className="w-5 h-5 text-spring shrink-0" />
          <div className="flex-1 min-w-0">
            <b className="text-[13px]">{t("attendance.m.manual")}</b>
            <p className="text-[12px] text-steel">{t("attendance.m.manualDesc")}</p>
          </div>
          <span className="b-badge b-badge-success">{t("attendance.m.on")}</span>
        </div>
        {rows.map((r) => (
          <div key={r.key} className="b-card-sm p-3.5 flex items-center gap-3">
            <r.icon className="w-5 h-5 text-spring shrink-0" />
            <div className="flex-1 min-w-0">
              <b className="text-[13px]">{r.title}</b>
              <p className="text-[12px] text-steel leading-5">{r.desc}</p>
            </div>
            {canManage ? (
              <button
                type="button"
                role="switch"
                aria-checked={settings[r.key]}
                onClick={() => setFlag(r.key, !settings[r.key])}
                className={`b-btn !h-9 !px-3.5 !text-[12px] ${settings[r.key] ? "b-btn-primary" : "b-btn-ghost"}`}
              >
                {settings[r.key] ? t("attendance.m.on") : t("attendance.m.off")}
              </button>
            ) : (
              <span className={`b-badge ${settings[r.key] ? "b-badge-success" : "b-badge-neutral"}`}>
                {settings[r.key] ? t("attendance.m.on") : t("attendance.m.off")}
              </span>
            )}
          </div>
        ))}
      </div>

      {canManage && draft && (
        <button type="button" className="b-btn b-btn-primary self-start" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t("attendance.m.saveSettings")}
        </button>
      )}

      {settings.codeEnabled && classId && <SessionCodeCard classId={classId} />}
      {settings.qrEnabled && <ScanCard onScanned={() => refetch()} />}
      {settings.kioskEnabled && classId && <KioskBoard classId={classId} />}
      {settings.externalEnabled && canManage && (
        <IntegrationKeys keys={data.keys} onChange={() => refetch()} />
      )}
    </div>
  );
}

/* ═══════════════ کد چرخان کلاس ═══════════════ */
function SessionCodeCard({ classId }: { classId: string }) {
  const { t } = useLang();
  const [info, setInfo] = useState<{ code: string; refreshInSec: number } | null>(null);
  const [left, setLeft] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/session-code?classId=${classId}`);
      if (!res.ok) return;
      const j = await res.json();
      const d = j.data ?? j;
      setInfo({ code: d.code, refreshInSec: d.refreshInSec });
      setLeft(d.refreshInSec);
    } catch { /* ساکت */ }
  }, [classId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!info) return;
    const iv = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) { load(); return info.refreshInSec; }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [info, load]);

  if (!info) return null;
  return (
    <div className="b-card-sm p-4 flex flex-col items-center gap-1.5">
      <span className="text-[12px] text-steel">{t("attendance.m.sessionCode")}</span>
      <span className="text-[34px] font-black tracking-[0.35em] leading-10" dir="ltr">{faNumber(info.code)}</span>
      <span className="text-[12px] text-steel">
        {t("attendance.m.sessionCodeHint")} · {t("attendance.m.refreshIn")} {faNumber(left)} {t("attendance.m.seconds")}
      </span>
    </div>
  );
}

/* ═══════════════ اسکن کارت QR (دوربین + ورود دستی) ═══════════════ */
function ScanCard({ onScanned }: { onScanned: () => void }) {
  const { t } = useLang();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const submit = useCallback(async (body: { payload?: string; studentNumber?: string }) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await apiPost<{ created: boolean; student: string }>("/api/attendance/scan", body);
      toast.success(`${res.created ? t("attendance.m.scannedOk") : t("attendance.m.alreadyRecorded")} ${res.student}`);
      onScanned();
    } catch {
      toast.error(t("common.error"));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [onScanned, t]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    setCameraOn(false);
  }, []);

  const startCamera = async () => {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> } }).BarcodeDetector;
    if (!BD || !navigator.mediaDevices?.getUserMedia) { setUnsupported(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraOn(true);
      const detector = new BD({ formats: ["qr_code"] });
      requestAnimationFrame(async function loop() {
        const video = videoRef.current;
        if (!streamRef.current || !video) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length > 0 && codes[0].rawValue) {
            await submit({ payload: codes[0].rawValue });
          }
        } catch { /* فریم آماده نیست */ }
        if (streamRef.current) requestAnimationFrame(loop);
      });
    } catch {
      setUnsupported(true);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (cameraOn && video && streamRef.current) {
      video.srcObject = streamRef.current;
      video.play().catch(() => undefined);
    }
  }, [cameraOn]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return (
    <div className="b-card-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <ScanLine className="w-4.5 h-4.5 text-spring" />
        <b className="text-[13px]">{t("attendance.m.scanTitle")}</b>
      </div>
      <p className="text-[12px] text-steel">{t("attendance.m.scanHint")}</p>
      {cameraOn && (
        <video ref={videoRef} className="w-full max-w-80 self-center rounded-2xl" muted playsInline />
      )}
      <div className="flex flex-wrap items-center gap-2">
        {cameraOn ? (
          <button type="button" className="b-btn b-btn-ghost !h-10" onClick={stopCamera}>
            <CameraOff className="w-4 h-4" /> {t("common.close")}
          </button>
        ) : (
          <button type="button" className="b-btn b-btn-ghost !h-10" onClick={startCamera}>
            <Camera className="w-4 h-4" /> {t("attendance.m.scanTitle")}
          </button>
        )}
        <input
          className="b-input !h-10 flex-1 min-w-40"
          inputMode="numeric"
          placeholder={t("attendance.m.scanManual")}
          value={manual}
          onChange={(e) => setManual(e.target.value)}
        />
        <button
          type="button"
          className="b-btn b-btn-primary !h-10"
          disabled={busy || !manual.trim()}
          onClick={() => { submit({ studentNumber: manual.trim() }); setManual(""); }}
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t("attendance.m.scanButton")}
        </button>
      </div>
      {unsupported && <p className="text-[12px] text-warning-deep">{t("attendance.m.cameraUnsupported")}</p>}
    </div>
  );
}

/* ═══════════════ کلیدهای اتصال سامانه‌های بیرونی ═══════════════ */
function IntegrationKeys({ keys, onChange }: { keys: KeyRow[]; onChange: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [method, setMethod] = useState("FACE");
  const [plainKey, setPlainKey] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), method }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error?.message ?? "");
      setPlainKey((j.data ?? j).plainKey);
      toast.success(t("attendance.m.keyCreated"));
      setName("");
      onChange();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm(t("attendance.m.keyRevokeConfirm"))) return;
    try {
      const res = await fetch(`/api/attendance/settings?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(t("attendance.m.keyRevoked"));
      onChange();
    } catch {
      toast.error(t("common.error"));
    }
  };

  return (
    <div className="b-card-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4.5 h-4.5 text-spring" />
        <b className="text-[13px]">{t("attendance.m.keysTitle")}</b>
      </div>
      <p className="text-[12px] text-steel leading-5">{t("attendance.m.keysDesc")}</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 flex-1 min-w-44">
          <span className="text-[12px] text-steel">{t("attendance.m.keyName")}</span>
          <input className="b-input !h-10" placeholder={t("attendance.m.keyNamePlaceholder")} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] text-steel">{t("attendance.m.keyMethod")}</span>
          <Select
            value={method}
            onChange={setMethod}
            options={["FACE", "CCTV", "NFC", "GATE", "OTHER"].map((m) => ({ value: m, label: t(`attendance.m.method.${m}`) }))}
          />
        </label>
        <button type="button" className="b-btn b-btn-primary !h-10" onClick={create} disabled={busy || !name.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          {t("attendance.m.keyCreate")}
        </button>
      </div>
      {plainKey && (
        <div className="flex items-center gap-2 rounded-xl bg-spring-tint p-3">
          <code className="flex-1 text-[12px] break-all" dir="ltr">{plainKey}</code>
          <button
            type="button"
            className="b-btn b-btn-ghost !h-9 !px-3 !text-[12px]"
            onClick={() => { navigator.clipboard?.writeText(plainKey); toast.success(t("attendance.m.keyCopied")); }}
          >
            <Copy className="w-3.5 h-3.5" /> {t("attendance.m.keyCopy")}
          </button>
        </div>
      )}
      {keys.length > 0 && (
        <div className="flex flex-col gap-2">
          {keys.map((k) => {
            const Icon = METHOD_ICONS[k.method] ?? Plug;
            return (
              <div key={k.id} className="flex items-center gap-3 rounded-xl border border-hairline p-3">
                <Icon className="w-4.5 h-4.5 text-steel shrink-0" />
                <div className="flex-1 min-w-0">
                  <b className="text-[13px]">{k.name}</b>
                  <span className="text-[12px] text-steel block">
                    {t(`attendance.m.method.${k.method}`)} · {t("attendance.m.keyLastUsed")}: {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString("fa-IR") : t("attendance.m.keyNeverUsed")}
                  </span>
                </div>
                <span className={`b-badge ${k.isActive ? "b-badge-success" : "b-badge-neutral"}`}>
                  {k.isActive ? t("attendance.m.keyActive") : t("attendance.m.keyInactive")}
                </span>
                {k.isActive && (
                  <button type="button" className="b-btn b-btn-ghost !h-9 !px-2.5" onClick={() => revoke(k.id)} aria-label={t("attendance.m.keyRevoke")}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ کیوسک: برگهٔ لمسی بزرگ برای تبلت مشترک ═══════════════ */
type KioskStudent = { studentId: string; fullName: string; studentNumber: string; status: string | null };

function KioskBoard({ classId }: { classId: string }) {
  const { t } = useLang();
  const today = todayJalali();
  const { data, refetch } = useApi<{ students: KioskStudent[]; date: string }>(
    classId ? `/api/attendance?classId=${classId}&date=${today}` : null, [classId],
  );
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  if (!data) return null;

  const tap = async (st: KioskStudent) => {
    const next = st.status === "PRESENT" ? "ABSENT" : "PRESENT";
    setBusyId(st.studentId);
    try {
      await apiPost("/api/attendance", {
        classId,
        date: data.date,
        method: "KIOSK",
        records: [{ studentId: st.studentId, status: next }],
      });
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="b-card-sm p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MonitorSmartphone className="w-4.5 h-4.5 text-spring" />
        <b className="text-[13px]">{t("attendance.m.kiosk")}</b>
        <button type="button" className="b-btn b-btn-ghost !h-9 !px-3 !text-[12px] ms-auto" onClick={() => setOpen((v) => !v)}>
          {open ? t("common.close") : t("attendance.m.kiosk")}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {data.students.map((st) => (
            <button
              key={st.studentId}
              type="button"
              disabled={busyId === st.studentId}
              onClick={() => tap(st)}
              className={`rounded-2xl border p-4 min-h-20 flex flex-col items-center justify-center gap-1 text-center ${
                st.status === "PRESENT"
                  ? "border-spring bg-spring-tint"
                  : st.status === "ABSENT"
                    ? "border-blossom bg-blossom-tint"
                    : "border-hairline"
              }`}
            >
              <b className="text-[14px] leading-5">{st.fullName}</b>
              <span className="text-[12px] text-steel">
                {st.status === "PRESENT" ? t("enum.attendance.PRESENT") : st.status === "ABSENT" ? t("enum.attendance.ABSENT") : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════ کارت دانش‌آموز: QR امروز + اعلام حضور با کد کلاس ═══════════════ */
export function StudentCheckinCard() {
  const { t } = useLang();
  const { data, refetch } = useApi<{ qrEnabled: boolean; codeEnabled: boolean; qrSvg: string | null }>("/api/attendance/checkin");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data || (!data.qrEnabled && !data.codeEnabled)) return null;

  const submitCode = async () => {
    setBusy(true);
    try {
      const res = await apiPost<{ created: boolean }>("/api/attendance/checkin", { code: code.trim() });
      toast.success(res.created ? t("attendance.m.checkinOk") : t("attendance.m.checkinAlready"));
      setCode("");
      refetch();
    } catch {
      toast.error(t("common.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.qrEnabled && data.qrSvg && (
        <div className="b-card p-5 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 self-start">
            <QrCode className="w-5 h-5 text-spring" />
            <h3 className="font-bold text-[15px]">{t("attendance.m.myQr")}</h3>
          </div>
          <div className="rounded-2xl bg-white p-2" dangerouslySetInnerHTML={{ __html: data.qrSvg }} />
          <p className="text-[12px] text-steel text-center">{t("attendance.m.myQrHint")}</p>
        </div>
      )}
      {data.codeEnabled && (
        <div className="b-card p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-spring" />
            <h3 className="font-bold text-[15px]">{t("attendance.m.checkinTitle")}</h3>
          </div>
          <p className="text-[13px] text-steel">{t("attendance.m.checkinHint")}</p>
          <div className="flex items-center gap-2">
            <input
              className="b-input !h-11 flex-1 text-center tracking-[0.3em]"
              inputMode="numeric"
              maxLength={6}
              placeholder="۰۰۰۰۰۰"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="button" className="b-btn b-btn-primary !h-11" disabled={busy || code.trim().length !== 6} onClick={submitCode}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {t("attendance.m.checkinButton")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
