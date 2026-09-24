"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { clearSession, homeFor, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

// One stroked 24px path per tab (docs/UI_GUIDE.md §9). Inline, no icon library.
const ICONS = {
  ride: "M3 13l2-6h14l2 6v5H3zM3 13h18M7 16h.01M17 16h.01",
  request: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v8M8 12h8",
  history: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  wallet: "M3 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l12-3v3M16 13h.01",
  dashboard: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trip: "M3 11l18-8-8 18-2-8z",
  trips: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};

export interface Tab {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  disabled?: boolean; // e.g. Trip with no active pool
  live?: boolean; // shows a dot, e.g. a trip in progress
}

// Wraps every signed-in page: sends signed-out users to /login and the wrong role to their own
// dashboard. This is a UX guard only — the API enforces roles and ownership on every call
// (docs/API_SPEC.md → Authorization).
export function AppShell({ role, tabs, children }: { role: Role; tabs: Tab[]; children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session === undefined) return; // still reading localStorage
    if (!session) router.replace("/login");
    else if (session.user.role !== role) router.replace(homeFor(session.user.role));
  }, [session, role, router]);

  if (session?.user.role !== role) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-border bg-background">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between gap-4 px-4">
          <Link href={homeFor(role)} className="shrink-0 font-semibold">
            Dhaka Tesla Pool
          </Link>
          {/* Desktop: tabs inline in the one header bar. */}
          <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
            {tabs.map((tab) => (
              <TabLink key={tab.label} tab={tab} active={isActive(tab.href)} layout="inline" />
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-muted">
              {session.user.name}
              <span className="hidden lg:inline"> · {role === "DRIVER" ? "Driver" : "Passenger"}</span>
            </span>
            {/* Clearing the session re-runs the effect above, which redirects to /login. */}
            <Button variant="ghost" size="sm" onClick={clearSession}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* Bottom padding on mobile keeps content clear of the fixed tab bar. */}
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-28 md:pb-8">
        {children}
      </main>

      {/* Mobile: a fixed bottom tab bar, within thumb reach. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <TabLink key={tab.label} tab={tab} active={isActive(tab.href)} layout="stacked" />
          ))}
        </div>
      </nav>
    </>
  );
}

function TabLink({ tab, active, layout }: { tab: Tab; active: boolean; layout: "inline" | "stacked" }) {
  const base =
    layout === "inline"
      ? "flex h-9 items-center gap-2 rounded-lg px-3"
      : "flex h-16 flex-col items-center justify-center gap-1 text-xs";
  const content = (
    <>
      <span className="relative">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={ICONS[tab.icon]} />
        </svg>
        {tab.live && (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground ring-2 ring-background" />
        )}
      </span>
      <span>
        {tab.label}
        {tab.live && <span className="sr-only"> (in progress)</span>}
      </span>
    </>
  );

  // A disabled tab isn't a link at all, so it can't be focused or followed.
  if (tab.disabled) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted opacity-50`}>
        {content}
      </span>
    );
  }
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`${base} text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground ${layout === "inline" ? "hover:bg-surface aria-[current=page]:bg-surface" : ""}`}
    >
      {content}
    </Link>
  );
}
