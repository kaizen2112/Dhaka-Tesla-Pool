import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };

// Filled in by the driver UI commit (docs/COMMIT_PLAN.md → 20).
export default function DriverDashboardPage() {
  return <h1 className="text-2xl font-semibold tracking-tight">Your Tesla</h1>;
}
