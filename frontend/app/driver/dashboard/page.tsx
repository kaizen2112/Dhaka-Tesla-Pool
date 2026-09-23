import type { Metadata } from "next";
import { DriverDashboard } from "@/components/ride/driver-dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default function DriverDashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <DriverDashboard />
    </>
  );
}
