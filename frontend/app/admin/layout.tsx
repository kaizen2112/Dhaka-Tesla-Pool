import type { ReactNode } from "react";
import { AppShell, type Tab } from "@/components/app-shell";

// The admin reads everything and decides complaints; nothing here changes a ride
// (docs/API_SPEC.md → Admin). The API checks the role on every call; the shell's redirect is UX.
const TABS: Tab[] = [
  { href: "/admin/dashboard", label: "Overview", icon: "dashboard" },
  { href: "/admin/complaints", label: "Complaints", icon: "complaints" },
  { href: "/admin/users", label: "Users", icon: "users" },
  { href: "/admin/trips", label: "Trips", icon: "trips" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell role="ADMIN" tabs={TABS}>
      {children}
    </AppShell>
  );
}
