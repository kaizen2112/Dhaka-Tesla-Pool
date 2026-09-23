import type { Metadata } from "next";
import { RideHistory } from "@/components/ride/ride-history";

export const metadata: Metadata = { title: "Ride history" };

export default function RideHistoryPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Ride history</h1>
      <RideHistory />
    </>
  );
}
