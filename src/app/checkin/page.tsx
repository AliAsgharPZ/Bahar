"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LogIn, QrCode, ShieldX, Sprout } from "lucide-react";
import { LangProvider, useLang } from "@/lib/i18n";

type State = "checking" | "ok" | "already" | "invalid" | "login" | "notStudent";

function CheckinInner() {
  const { t } = useLang();
  const params = useSearchParams();
  const token = params.get("t") ?? "";
  const [state, setState] = useState<State>("checking");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) {
      setState("invalid");
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/attendance/school-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (res.status === 401) {
          sessionStorage.setItem("bahar-school-token", token);
          setState("login");
          return;
        }
        if (res.status === 403) {
          setState("notStudent");
          return;
        }
        if (!res.ok) {
          setState("invalid");
          return;
        }
        const data = (await res.json()) as { created?: boolean };
        setState(data.created ? "ok" : "already");
      } catch {
        setState("invalid");
      }
    })();
  }, [token]);

  return (
    <main className="min-h-dvh flex items-center justify-center p-4">
      <div className="b-card p-6 w-full max-w-sm flex flex-col items-center gap-3 text-center">
        <span className="flex items-center gap-2 text-spring">
          <Sprout className="w-6 h-6" />
          <b className="text-lg text-ink">{t("attendance.g.title")}</b>
        </span>

        {state === "checking" && (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-spring" />
            <p className="text-[13px] text-steel">{t("attendance.g.checking")}</p>
          </>
        )}
        {(state === "ok" || state === "already") && (
          <>
            <CheckCircle2 className="w-12 h-12 text-success" />
            <p className="font-bold">{state === "ok" ? t("attendance.g.ok") : t("attendance.g.already")}</p>
            <Link href="/app/attendance" className="b-btn b-btn-primary !h-11">
              {t("attendance.g.goApp")}
            </Link>
          </>
        )}
        {state === "invalid" && (
          <>
            <ShieldX className="w-12 h-12 text-danger" />
            <p className="font-bold">{t("attendance.g.invalid")}</p>
            <p className="text-[13px] text-steel">{t("attendance.g.invalidHint")}</p>
          </>
        )}
        {state === "login" && (
          <>
            <QrCode className="w-12 h-12 text-spring" />
            <p className="font-bold">{t("attendance.g.loginFirst")}</p>
            <p className="text-[13px] text-steel">{t("attendance.g.loginHint")}</p>
            <Link href="/login" className="b-btn b-btn-primary !h-11">
              <LogIn className="w-4 h-4" />
              {t("attendance.g.loginButton")}
            </Link>
          </>
        )}
        {state === "notStudent" && (
          <>
            <ShieldX className="w-12 h-12 text-warning" />
            <p className="font-bold">{t("attendance.g.notStudent")}</p>
            <Link href="/app" className="b-btn b-btn-ghost !h-11">
              {t("attendance.g.goApp")}
            </Link>
          </>
        )}
      </div>
    </main>
  );
}

export default function CheckinPage() {
  return (
    <LangProvider>
      <Suspense fallback={null}>
        <CheckinInner />
      </Suspense>
    </LangProvider>
  );
}
