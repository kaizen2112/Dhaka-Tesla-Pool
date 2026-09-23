"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { clearSession, homeFor, useSession } from "@/lib/session";
import type { Role } from "@/lib/types";

// Wraps every signed-in page: sends signed-out users to /login and the wrong role to their own
// dashboard. This is a UX guard only — the API enforces roles and ownership on every call
// (docs/API_SPEC.md → Authorization).
export function AppShell({
  role,
  links = [],
  children,
}: {
  role: Role;
  links?: { href: string; label: string }[];
  children: ReactNode;
}) {
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-4 px-4">
          <Link href={homeFor(role)} className="font-semibold">
            Dhaka Tesla Pool
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-muted">
              {session.user.name}
              <span className="hidden sm:inline"> · {role === "DRIVER" ? "Driver" : "Passenger"}</span>
            </span>
            {/* Clearing the session re-runs the effect above, which redirects to /login. */}
            <Button variant="ghost" size="sm" onClick={clearSession}>
              Sign out
            </Button>
          </div>
        </div>
        {links.length > 0 && (
          <nav className="mx-auto flex h-10 w-full max-w-2xl items-center gap-5 px-4">
            {links.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className="text-muted hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground"
              >
                {label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-8">{children}</main>
    </>
  );
}
