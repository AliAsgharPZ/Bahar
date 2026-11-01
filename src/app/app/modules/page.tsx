"use client";

import { useState } from "react";
import Link from "next/link";
import { useApi } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { useLang } from "@/lib/i18n";

type Def = { slug: string; category: string; title: string; description: string };
type Data = { total: number; page: number; size: number; items: Def[] };
const CATS = [
  ["edu", "آموزشی"], ["att", "حضوروغیاب"], ["fin", "مالی"], ["par", "ارتباط با والدین"],
  ["health", "سلامت و ایمنی"], ["trans", "حمل‌ونقل"], ["lib", "کتابخانه و منابع"], ["extra", "فوق‌برنامه"],
  ["admin", "اداری و دفتری"], ["welfare", "رفاه و انگیزش"], ["tech", "فناوری و تجهیزات"], ["events", "رویدادها"],
] as const;

export default function ModulesPage() {
  const { t } = useLang();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const url = `/api/modules?${category ? `category=${category}&` : ""}${q ? `q=${encodeURIComponent(q)}&` : ""}page=${page}`;
  const { data, loading, error, refetch } = useApi<Data>(url, [category, q, page]);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={error || t("common.error")} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("modules.title")} desc={t("modules.desc")} />
      <div className="grid gap-3 md:grid-cols-2">
        <select className="b-input w-full" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }} aria-label={t("modules.category")}>
          <option value="">{t("modules.allCategories")}</option>
          {CATS.map(([code, label]) => <option key={code} value={code}>{label}</option>)}
        </select>
        <input className="b-input w-full" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("modules.searchPh")} aria-label={t("modules.searchPh")} />
      </div>
      <p className="text-sm text-muted-foreground">{faNumber(data.total)} {t("modules.count")}</p>
      {data.items.length === 0 ? (
        <EmptyState title={t("modules.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((d) => (
            <Link key={d.slug} href={`/app/modules/${d.slug}`} className="b-card p-4 space-y-1 block">
              <p className="font-bold">{d.title}</p>
              <p className="text-sm text-muted-foreground">{d.category} · {d.description}</p>
            </Link>
          ))}
        </section>
      )}
      <div className="flex items-center gap-2">
        <button className="b-btn b-btn-ghost min-h-11" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("common.previous")}</button>
        <span className="text-sm">{faNumber(page)}</span>
        <button className="b-btn b-btn-ghost min-h-11" disabled={data.items.length < data.size} onClick={() => setPage(page + 1)}>{t("common.next")}</button>
      </div>
    </div>
  );
}
