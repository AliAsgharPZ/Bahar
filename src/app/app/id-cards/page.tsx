"use client";

import { useCallback, useEffect, useState } from "react";
import { IdCard, Printer, School } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/client";
import { faDigits } from "@/lib/persian";
import { PageHeader, LoadingBlock, EmptyState, ErrorBox } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { UserAvatar } from "@/components/shared/user-avatar";
import type { AvatarUserInput } from "@/lib/avatar";
import { useLang } from "@/lib/i18n";

type ClassRow = { id: string; name: string; grade: string | null };
type StudentRow = {
  id: string;
  studentNumber: string | null;
  user: AvatarUserInput & { nationalId: string };
  class: { name: string; grade: string | null } | null;
};

/** نوارهای بارکد تزئینیِ قطعی از روی شمارهٔ دانش‌آموزی (برای چاپ کارت) */
function Barcode({ seed }: { seed: string }) {
  const bars: Array<{ w: number; gap: number }> = [];
  let h = 7;
  for (const ch of seed || "0") {
    h = (h * 31 + ch.charCodeAt(0)) % 997;
    bars.push({ w: 1 + (h % 3), gap: 1 + ((h >> 2) % 3) });
  }
  return (
    <span className="flex items-stretch h-8" aria-hidden="true">
      {bars.map((b, i) => (
        <span key={i} style={{ width: b.w, marginInlineEnd: b.gap }} className="bg-black/85 inline-block" />
      ))}
    </span>
  );
}

export default function IdCardsPage() {
  const { t } = useLang();
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [schoolName, setSchoolName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    apiGet<{ classes: ClassRow[] }>("/api/classes")
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => setLoadError(t("idCards.fhrst-klas-ha-bargzary-nshd")));
    apiGet<{ user?: { school?: { name?: string } | null; actingSchool?: { name?: string } | null } }>("/api/auth/me")
      .then((d) => setSchoolName(d.user?.school?.name ?? d.user?.actingSchool?.name ?? ""))
      .catch(() => setSchoolName(""));
  }, []);

  const loadStudents = useCallback((cid: string) => {
    if (!cid) { setStudents([]); return; }
    setLoading(true);
    apiGet<{ students: StudentRow[] }>(`/api/students?classId=${cid}`)
      .then((d) => { setStudents(d.students ?? []); setLoadError(""); })
      .catch((e) => { setLoadError(e instanceof Error ? e.message : t("common.errorShort")); toast.error(t("idCards.fhrst-dansh-amvzan-bargzary-nshd")); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #id-cards-print, #id-cards-print * { visibility: visible !important; }
          #id-cards-print { position: absolute !important; inset: 0 !important; padding: 8mm !important; }
          .id-card-print { break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
      <PageHeader
        title={t("idCards.kart-shnasayy-dansh-amvz")}
        desc={t("idCards.kart-chapy-hr-klas-ba-aks-avatar-shmarh-dansh-amvzy-v-barkd-amad")}
        action={students.length > 0 ? (
          <button className="b-btn b-btn-spring" onClick={() => window.print()}>
            <Printer className="w-4 h-4" /> {t("idCards.chap-kart-ha")}
          </button>
        ) : undefined}
      />

      {loadError && <ErrorBox message={loadError} />}

      <div className="b-card p-4 mb-6 flex flex-wrap items-end gap-3 no-print">
        <label className="b-field flex-1 min-w-56">
          <span>{t("common.class")}</span>
          <Select value={classId} onChange={(v) => { setClassId(v); loadStudents(v); }} placeholder={t("idCards.yk-klas-ra-antkhab-knyd")}
            options={classes.map((c) => ({ value: c.id, label: `${c.name}${c.grade ? ` · ${c.grade}` : ""}` }))} />
        </label>
        <p className="text-[12px] text-stone pb-2">{t("idCards.bad-az-antkhab-klas-kart-hmh-dansh-amvzan-sakhth-my-shvd-v-ba-dk")}</p>
      </div>

      {loading ? <LoadingBlock /> : students.length === 0 ? (
        <EmptyState icon={School} title={t("idCards.klasy-antkhab-nshdh")} desc={t("idCards.bray-sakht-kart-ha-yk-klas-ra-antkhab-knyd")} />
      ) : (
        <div id="id-cards-print" className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {students.map((s) => (
            <article key={s.id} className="id-card-print b-card overflow-hidden">
              <header className="px-4 py-2.5 flex items-center gap-2 text-white" style={{ background: "linear-gradient(120deg, var(--spring-deep), var(--spring))" }}>
                <School className="w-4 h-4 shrink-0" />
                <b className="text-[12.5px] truncate">{schoolName || t("common.school")}</b>
                <span className="ms-auto text-[12px] opacity-85">{t("idCards.kart-dansh-amvzy")}</span>
              </header>
              <div className="p-4 flex gap-3.5">
                <UserAvatar user={s.user} size={76} rounded="xl" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[15.5px] leading-snug truncate">{s.user.firstName} {s.user.lastName}</h3>
                  <dl className="text-[11.5px] text-stone mt-1.5 space-y-1">
                    <div className="flex gap-1.5"><dt>{t("common.class")}:</dt><dd className="font-semibold text-[--ink]">{s.class?.name ?? "—"}{s.class?.grade ? ` ${t("idCards.payh")} ${s.class.grade}` : ""}</dd></div>
                    <div className="flex gap-1.5"><dt>{t("students.field.studentNumber")}:</dt><dd className="font-semibold text-[--ink]">{s.studentNumber ? faDigits(s.studentNumber) : "—"}</dd></div>
                    <div className="flex gap-1.5"><dt>{t("students.table.nationalId")}:</dt><dd className="font-semibold text-[--ink]">{faDigits(s.user.nationalId)}</dd></div>
                  </dl>
                </div>
              </div>
              <footer className="px-4 pb-3.5 flex items-end justify-between gap-3">
                <Barcode seed={s.studentNumber ?? s.id} />
                <span className="text-[12px] text-stone">{t("idCards.ayn-kart-mtalq-bh-mdrsh-ast")}</span>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
