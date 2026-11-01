"use client";

/**
 * AppShellPattern — Shadcn Admin / Shadboard shell layout pattern,
 * rebuilt for Bahar (Next.js App Router, not Vite).
 * Pattern only: it renders caller-provided sidebar, search, actions, and
 * content slots. It never replaces the live /app shell from here.
 *
 * Bahar customizations: sidebar at the inline-start edge, topbar with a
 * quiet border, content breathing room, logical spacing throughout.
 * On small screens the sidebar becomes a start-edge drawer.
 */

import * as React from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/utils";

export function AppShellPattern({
  sidebar,
  searchSlot,
  topbarActions,
  title,
  children,
  className,
}: {
  sidebar: React.ReactNode;
  searchSlot?: React.ReactNode;
  topbarActions?: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("flex min-h-screen", className)}>
      {/* Desktop sidebar: inline-start edge */}
      <aside className="hidden w-72 shrink-0 border-e border-hairline-soft bg-card lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto p-4">
          {sidebar}
        </div>
      </aside>

      {/* Mobile drawer: same sidebar, start edge */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-overlay opacity-60"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 start-0 w-72 overflow-y-auto border-e border-hairline-soft bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-4">
              <span className="text-base font-bold leading-tight text-ink">
                {title}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="بستن منو"
                className="b-btn b-btn-ghost min-h-11 min-w-11"
              >
                <X size={20} />
              </button>
            </div>
            {sidebar}
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-hairline-soft bg-background">
          <div className="flex min-h-16 items-center gap-4 px-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="باز کردن منو"
              className="b-btn b-btn-ghost min-h-11 min-w-11 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold leading-tight text-ink">
              {title}
            </h1>
            {searchSlot ? (
              <div className="hidden min-w-0 flex-1 max-w-md md:block">
                {searchSlot}
              </div>
            ) : null}
            {topbarActions ? (
              <div className="flex shrink-0 items-center gap-2">
                {topbarActions}
              </div>
            ) : null}
          </div>
          {searchSlot ? (
            <div className="px-4 pb-4 md:hidden">{searchSlot}</div>
          ) : null}
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
