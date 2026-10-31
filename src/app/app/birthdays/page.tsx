"use client";

import { toast } from "sonner";
import { Cake, PartyPopper } from "lucide-react";
import { useApi, apiPost } from "@/lib/client";
import { PageHeader, LoadingBlock, ErrorBox, EmptyState } from "@/components/shared/bits";
import { faNumber } from "@/lib/persian";
import { ROLE_LABELS } from "@/lib/roles";
import { useLang } from "@/lib/i18n";

type Item = { userId: string; name: string; role: string; month: number; day: number; isToday: boolean };
type Data = { items: Item[]; todayCount: number };

export default function BirthdaysPage() {
  const { t } = useLang();
  const { data, loading, error } = useApi<Data>("/api/birthdays");
  if (loading) return <LoadingBlock />;
  if (error || !data) return <ErrorBox message={t("common.error")} />;

  const greet = async (userId: string) => {
    try { await apiPost("/api/birthdays", { userId }); toast.success(t("birthdays.sentToast")); }
    catch (e) { toast.error(e instanceof Error ? e.message : t("common.error")); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("birthdays.title")} desc={t("birthdays.desc")} />
      {data.items.length === 0 ? (
        <EmptyState title={t("birthdays.empty")} />
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {data.items.map((i) => (
            <article key={i.userId} className={`b-card p-4 flex items-center gap-3 ${i.isToday ? "border-primary" : ""}`}>
              <Cake className={`w-8 h-8 ${i.isToday ? "text-primary" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <p className="font-bold">{i.name}</p>
                <p className="text-sm text-muted-foreground">
                  {ROLE_LABELS[i.role] ?? i.role} · {faNumber(i.day)} {t("birthdays.ofMonth")} {faNumber(i.month)}
                  {i.isToday ? ` · ${t("birthdays.todayBadge")}` : ""}
                </p>
              </div>
              {i.isToday && (
                <button className="b-btn b-btn-primary min-h-11" onClick={() => greet(i.userId)}>
                  <PartyPopper className="w-4 h-4" /> {t("birthdays.greet")}
                </button>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
