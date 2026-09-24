import type { Metadata } from "next";
import { DriverTrips } from "@/components/ride/driver-trips";

export const metadata: Metadata = { title: "Trips" };

export default function DriverTripsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
      <DriverTrips />
    </>
  );
}
