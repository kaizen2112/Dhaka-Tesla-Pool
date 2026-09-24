"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Skeleton } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { clearSession, homeFor, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

// One stroked 24px path per icon (docs/UI_GUIDE.md §9). Inline, no icon library.
const ICONS = {
  ride: "M3 13l2-6h14l2 6v5H3zM3 13h18M7 16h.01M17 16h.01",
  request: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 8v8M8 12h8",
  history: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  wallet: "M3 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l12-3v3M16 13h.01",
  dashboard: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trip: "M3 11l18-8-8 18-2-8z",
  trips: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",
};
const SIGN_OUT = "M15 17l5-5-5-5M20 12H9M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7";
const COLLAPSE = "M15 18l-6-6 6-6";
const EXPAND = "M9 18l6-6-6-6";

export interface Tab {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  disabled?: boolean; // e.g. Trip with no active pool
  live?: boolean; // shows a dot, e.g. a trip in progress
}

function Icon({ d, className = "size-5" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

// Sidebar collapsed or not: a per-viewer convenience in localStorage (never state that matters).
const SIDEBAR_KEY = "tesla-pool-sidebar-collapsed";
const SIDEBAR_CHANGED = "tesla-pool-sidebar-changed";

function readCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribeCollapsed(onChange: () => void) {
  window.addEventListener(SIDEBAR_CHANGED, onChange);
  return () => window.removeEventListener(SIDEBAR_CHANGED, onChange);
}

function setCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage blocked: it just won't be remembered.
  }
  window.dispatchEvent(new Event(SIDEBAR_CHANGED));
}

// Wraps every signed-in page: sends signed-out users to /login and the wrong role to their own
// dashboard. This is a UX guard only — the API enforces roles and ownership on every call
// (docs/API_SPEC.md → Authorization).
//
// Layout (docs/UI_GUIDE.md §9): a top bar (app name · theme · you · sign out), a collapsible left
// sidebar with the pages from md: up, and a bottom tab bar on phones.
export function AppShell({ role, tabs, children }: { role: Role; tabs: Tab[]; children: ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

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
  const name = session.user.name;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link
            href={homeFor(role)}
            className="flex items-center gap-2.5 rounded-lg font-semibold focus-visible:outline-2 focus-visible:outline-foreground"
          >
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon d={ICONS.ride} className="size-4.5" />
            </span>
            <span className="truncate">Dhaka Tesla Pool</span>
          </Link>

          <div className="flex items-center gap-1 sm:gap-2">
            <ThemeToggle />
            <span aria-hidden className="mx-1 hidden h-6 w-px bg-border sm:block" />
            <div className="flex items-center gap-2.5 px-1">
              <span
                aria-hidden
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface text-xs font-semibold"
              >
                {name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden flex-col leading-tight sm:flex">
                <span className="font-medium">{name}</span>
                <span className="text-xs text-muted">{role === "DRIVER" ? "Driver" : "Passenger"}</span>
              </span>
            </div>
            {/* Clearing the session re-runs the effect above, which redirects to /login. */}
            <button
              type="button"
              onClick={clearSession}
              aria-label="Sign out"
              title="Sign out"
              className="flex h-9 items-center gap-2 rounded-lg px-2 text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground sm:px-3"
            >
              <Icon d={SIGN_OUT} className="size-4.5" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1">
        {/* md: and up — the pages, in a sidebar that can shrink to icons. */}
        <aside
          className={`sticky top-14 hidden h-[calc(100dvh-3.5rem)] shrink-0 flex-col border-r border-border bg-background transition-[width] duration-200 md:flex ${collapsed ? "w-[4.5rem]" : "w-60"}`}
        >
          <nav aria-label="Main" className="flex flex-1 flex-col gap-1 p-3">
            {!collapsed && (
              <p className="px-3 pt-1 pb-2 text-xs font-medium text-muted">
                {role === "DRIVER" ? "Driving" : "Riding"}
              </p>
            )}
            {tabs.map((tab) => (
              <SidebarLink key={tab.label} tab={tab} active={isActive(tab.href)} collapsed={collapsed} />
            ))}
          </nav>
          <div className="border-t border-border p-3">
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={`flex h-9 w-full items-center gap-3 rounded-lg px-3 text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Icon d={collapsed ? EXPAND : COLLAPSE} className="size-4.5" />
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Bottom padding on phones keeps content clear of the fixed tab bar. */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 pt-8 pb-28 md:px-8 md:pb-12">
            {children}
          </div>
        </main>
      </div>

      {/* Phones: a fixed bottom tab bar, within thumb reach. */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map((tab) => (
            <BottomTab key={tab.label} tab={tab} active={isActive(tab.href)} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabIcon({ tab }: { tab: Tab }) {
  return (
    <span className="relative shrink-0">
      <Icon d={ICONS[tab.icon]} />
      {tab.live && (
        <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-foreground ring-2 ring-background motion-safe:animate-pulse" />
      )}
    </span>
  );
}

function SidebarLink({ tab, active, collapsed }: { tab: Tab; active: boolean; collapsed: boolean }) {
  const base = `group relative flex h-10 items-center gap-3 rounded-lg text-sm transition-colors ${collapsed ? "justify-center" : "px-3"}`;
  const label = (
    <span className={collapsed ? "sr-only" : "truncate"}>
      {tab.label}
      {tab.live && <span className="sr-only"> (in progress)</span>}
    </span>
  );

  // A disabled page isn't a link at all, so it can't be focused or followed; the tooltip says why.
  if (tab.disabled) {
    return (
      <span
        aria-disabled="true"
        title={`${tab.label}: nothing active right now`}
        className={`${base} cursor-not-allowed text-muted opacity-50`}
      >
        <TabIcon tab={tab} />
        {label}
      </span>
    );
  }
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? tab.label : undefined}
      className={`${base} text-muted hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground aria-[current=page]:bg-surface aria-[current=page]:font-medium aria-[current=page]:text-foreground`}
    >
      {/* The active page gets a bar on the sidebar's inner edge. */}
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-1 rounded-r-full bg-foreground" />}
      <TabIcon tab={tab} />
      {label}
    </Link>
  );
}

function BottomTab({ tab, active }: { tab: Tab; active: boolean }) {
  const base = "flex h-16 flex-col items-center justify-center gap-1 text-xs";
  if (tab.disabled) {
    return (
      <span aria-disabled="true" className={`${base} cursor-not-allowed text-muted opacity-50`}>
        <TabIcon tab={tab} />
        {tab.label}
      </span>
    );
  }
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={`${base} relative text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground`}
    >
      {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-foreground" />}
      <TabIcon tab={tab} />
      <span>
        {tab.label}
        {tab.live && <span className="sr-only"> (in progress)</span>}
      </span>
    </Link>
  );
}
