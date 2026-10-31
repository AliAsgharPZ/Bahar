"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, Printer, ShieldX, Sprout } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";
import { faNumber } from "@/lib/persian";

type RosterRow = { studentId: string; studentName: string; className: string | null; parents: string[]; status: string; note: string | null };
type Detail = {
  request: { id: string; title: string; body: string; deadline: string | null };
  schoolName: string | null;
  roster: RosterRow[];
};

/** فهرست چاپی رضایت‌نامه: فقط تأییدشده‌ها با ستون امضا + شمارش رد و بی‌پاسخ */
function ConsentPrintInner() {
  const { t } = useLang();
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/consents?id=${params.id}`);
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { data?: Detail } & Detail;
        setData((json as { data?: Detail }).data ?? (json as Detail));
      } catch {
        setFailed(true);
      }
    })();
  }, [params.id]);

  if (failed) {
    return (
      <main className="mx-auto max-w-md p-6 text-center space-y-3">
        <ShieldX className="w-10 h-10 mx-auto text-destructive" />
        <p>این فهرست فقط برای کارکنان مدرسه قابل چاپ است.</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="flex items-center justify-center gap-2 p-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" /> در حال بارگذاری…
      </main>
    );
  }
  const approved = data.roster.filter((r) => r.status === "APPROVED");
  const declined = data.roster.filter((r) => r.status === "DECLINED").length;
  const pending = data.roster.length - approved.length - declined;

  return (
    <main className="mx-auto max-w-3xl p-4 print:p-0">
      <div className="flex items-center justify-between print:hidden mb-4">
        <p className="font-bold flex items-center gap-2"><Sprout className="w-5 h-5" /> {t("consents.print")}</p>
        <button className="b-btn b-btn-primary min-h-11" onClick={() => window.print()}><Printer className="w-4 h-4" /> چاپ</button>
      </div>
      <header className="text-center space-y-1 border-b border-border pb-3 mb-4">
        <p className="text-sm text-muted-foreground">{data.schoolName}</p>
        <h1 className="text-lg font-bold">{data.request.title}</h1>
        <p className="text-sm">
          {faNumber(approved.length)} {t("consents.approved")} · {faNumber(declined)} {t("consents.declined")} · {faNumber(pending)} {t("consents.pending")}
        </p>
      </header>
      <p className="text-sm leading-7 whitespace-pre-line border border-border rounded-lg p-3 mb-4">{data.request.body}</p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-border text-start">
            <th className="p-2 text-start">ردیف</th>
            <th className="p-2 text-start">دانش‌آموز</th>
            <th className="p-2 text-start">کلاس</th>
            <th className="p-2 text-start">ولی</th>
            <th className="p-2 text-start">امضای ولی</th>
          </tr>
        </thead>
        <tbody>
          {approved.map((r, i) => (
            <tr key={r.studentId} className="border-b border-border">
              <td className="p-2">{faNumber(i + 1)}</td>
              <td className="p-2 font-medium">{r.studentName}</td>
              <td className="p-2">{r.className ?? "—"}</td>
              <td className="p-2">{r.parents.join("، ")}</td>
              <td className="p-2 w-40"></td>
            </tr>
          ))}
        </tbody>
      </table>
      {approved.length === 0 && <p className="text-center text-muted-foreground py-6">{t("consents.pending")}</p>}
    </main>
  );
}

export default function ConsentPrintPage() {
  return (
    <LangProvider>
      <ConsentPrintInner />
    </LangProvider>
  );
}
