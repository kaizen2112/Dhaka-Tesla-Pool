"use client";

import type { ReactNode } from "react";
import { AppShell, type Tab } from "@/components/app-shell";
import { useApi } from "@/hooks/use-api";
import { useSession } from "@/lib/session";
import type { MyVehicle } from "@/lib/types";

// Client layout: the Trip tab needs to know whether Jashim has an active pool right now.
export default function DriverLayout({ children }: { children: ReactNode }) {
  const session = useSession();
  // Only once we know it's a driver; the shell redirects anyone else.
  const vehicle = useApi<MyVehicle>(session?.user.role === "DRIVER" ? "/vehicles/me" : null, 5000);
  const pool = vehicle.data?.activePool;

  const tabs: Tab[] = [
    { href: "/driver/dashboard", label: "Dashboard", icon: "dashboard" },
    {
      href: pool ? `/driver/ride/${pool.id}` : "/driver/dashboard",
      label: "Trip",
      icon: "trip",
      disabled: !pool,
      live: Boolean(pool),
    },
    { href: "/driver/trips", label: "Trips", icon: "trips" },
  ];

  return (
    <AppShell role="DRIVER" tabs={tabs}>
      {children}
    </AppShell>
  );
}
