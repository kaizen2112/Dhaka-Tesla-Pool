import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

const LINKS = [
  { href: "/passenger/dashboard", label: "Ride" },
  { href: "/passenger/request", label: "Request" },
  { href: "/passenger/history", label: "History" },
];

export default function PassengerLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="PASSENGER" links={LINKS}>
      {children}
    </AppShell>
  );
}
