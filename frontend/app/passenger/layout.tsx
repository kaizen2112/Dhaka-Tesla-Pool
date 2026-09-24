import type { ReactNode } from "react";
import { AppShell, type Tab } from "@/components/app-shell";

const TABS: Tab[] = [
  { href: "/passenger/dashboard", label: "Ride", icon: "ride" },
  { href: "/passenger/request", label: "Request", icon: "request" },
  { href: "/passenger/history", label: "History", icon: "history" },
  { href: "/passenger/wallet", label: "Wallet", icon: "wallet" },
];

export default function PassengerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="PASSENGER" tabs={TABS}>
      {children}
    </AppShell>
  );
}
