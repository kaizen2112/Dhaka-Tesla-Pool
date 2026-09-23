import type { Metadata } from "next";
import { PassengerDashboard } from "@/components/ride/passenger-dashboard";

export const metadata: Metadata = { title: "Your ride" };

export default function PassengerDashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Your ride</h1>
      <PassengerDashboard />
    </>
  );
}
