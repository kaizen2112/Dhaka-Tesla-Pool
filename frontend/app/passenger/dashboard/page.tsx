import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

// Filled in by the passenger UI commit (docs/COMMIT_PLAN.md → 19).
export default function PassengerDashboardPage() {
  return <h1 className="text-2xl font-semibold tracking-tight">Your rides</h1>;
}
