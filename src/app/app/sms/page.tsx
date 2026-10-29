"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Loader2, Send, Info, Trash2 } from "lucide-react";
import { useApi, apiPost, apiDelete } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { Select } from "@/components/shared/pickers";
import { formatDateFa, faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Log = { id: string; audience: string; text: string; recipientCount: number; status: string; createdAt: string };
type ClassRow = { id: string; name: string; academicYear: string };

const AUD_TKEY: Record<string, string> = { PARENTS: "students.table.parents", TEACHERS: "enum.aud.TEACHERS", STUDENTS: "nav.students", CLASS: "enum.aud.CLASS", ALL: "enum.aud.ALL" };

export default function SmsPage() {
  const { t } = useLang();
  const { data, loading, error, refetch } = useApi<{ logs: Log[]; provider: string }>("/api/sms");
  const { data: classesData } = useApi<{ classes: ClassRow[] }>("/api/classes");
  const [audience, setAudience] = useState("PARENTS");
  const [classId, setClassId] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    try {
      const r = await apiPost<{ recipients: number; notified: number }>("/api/sms", { audience, classId, text });
      toast.success(`${t("sms.sbt-shd")} ${faNumber(r.recipients)} ${t("sms.shmarh-matbr-aalan-drvn-brnamh-ay-bray")} ${faNumber(r.notified)} ${t("sms.nfr-sakhth-shd")}`);
      setText("");
      refetch();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("common.errorShort")); }
    finally { setSending(false); }
  }

  const logs = data?.logs ?? [];
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("nav.sms")} desc={t("sms.arsal-grvhy-pyam-bh-avlya-karknan-ya-dansh-amvzan")} />
      <div className="rounded-xl bg-blossom/10 border border-blossom/30 p-4 flex items-start gap-2 text-[12.5px]">
        <Info className="w-4 h-4 shrink-0 mt-0.5 text-blossom" />
        <span>{t("sms.dr-ayn-astqrar-nmayshy-drgah-pyamk-vaqay-vsl-nyst-arsal-ha-ba-vz")} ({t("sms.kavh-ngar")}/{t("sms.mly-pyamk-v")}) {t("sms.hmyn-pnl-vaqay-my-shvd")}</span>
      </div>

      <div className="b-card p-6 flex flex-col gap-4">
        <div className="grid md:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("sms.mkhatb")}</span>
            <Select className="w-full" buttonClassName="!w-full" value={audience} onChange={setAudience}
              options={Object.entries(AUD_TKEY).map(([value, key]) => ({ value, label: t(key) }))} placeholder={t("sms.mkhatb")} /></label>
          {audience === "CLASS" && (
            <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("common.class")}</span>
              <Select className="w-full" buttonClassName="!w-full" value={classId} onChange={setClassId}
                options={[{ value: "", label: t("sms.antkhab-klas") }, ...(classesData?.classes ?? []).map((c) => ({ value: c.id, label: `${c.name} · ${c.academicYear}` }))]} placeholder={t("sms.antkhab-klas")} /></label>
          )}
        </div>
        <label className="flex flex-col gap-1.5"><span className="text-[12px] font-bold">{t("sms.mtn-pyamk")} ({faNumber(text.length)}/{t("sms.500")})</span>
          <textarea className="b-input min-h-24" value={text} onChange={(e) => setText(e.target.value)} maxLength={500}
            placeholder={t("sms.msla-avlyay-gramy-jlsh-anjmn-avlya-v-mrbyan-rvz-pnjshnbh-saat-17")} /></label>
        <button className="b-btn b-btn-spring self-start" disabled={sending || text.trim().length < 3 || (audience === "CLASS" && !classId)} onClick={send}>
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} {t("sms.arsal")}
        </button>
      </div>

      {loading && <LoadingBlock />}
      {error && <ErrorBox message={error} />}
      {data && logs.length === 0 && <EmptyState icon={MessageSquare} title={t("sms.hnvz-pyamy-arsal-nshdh")} />}
      {logs.length > 0 && (
        <div className="b-card overflow-x-auto b-scroll">
          <table className="w-full text-[13px] min-w-[640px]">
            <thead><tr className="text-steel border-b border-hairline">
              <th className="p-3 text-start font-bold">{t("sms.zman")}</th>
              <th className="p-3 text-start font-bold">{t("sms.mkhatb")}</th>
              <th className="p-3 text-start font-bold">{t("sms.mtn")}</th>
              <th className="p-3 text-start font-bold">{t("sms.gyrndh")}</th>
              <th className="p-3 text-start font-bold">{t("common.status")}</th>
            </tr></thead>
            <tbody className="b-rows-in">
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-hairline last:border-0">
                  <td className="p-3 whitespace-nowrap">{formatDateFa(l.createdAt)}</td>
                  <td className="p-3">{t(AUD_TKEY[l.audience] ?? l.audience)}</td>
                  <td className="p-3 max-w-72 truncate">{l.text}</td>
                  <td className="p-3">{faNumber(l.recipientCount)} {t("sms.shmarh")}</td>
                  <td className="p-3"><span className="b-badge b-badge-neutral">{t("sms.nmayshy")}</span></td>
                  <td className="p-3"><button className="b-btn b-btn-ghost text-stone hover:text-destructive" aria-label={t("sms.hzf-rkvrd")} onClick={async () => { if (!window.confirm(t("sms.ayn-rkvrd-arsal-hzf-shvd"))) return; try { await apiDelete(`/api/sms?id=${l.id}`); toast.success(t("sms.hzf-shd")); refetch(); } catch (e) { toast.error(e instanceof Error ? e.message : t("common.errorShort")); } }}><Trash2 className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
