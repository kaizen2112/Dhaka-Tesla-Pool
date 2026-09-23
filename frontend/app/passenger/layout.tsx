import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

export default function PassengerLayout({ children }: { children: ReactNode }) {
  return <AppShell role="PASSENGER">{children}</AppShell>;
}
