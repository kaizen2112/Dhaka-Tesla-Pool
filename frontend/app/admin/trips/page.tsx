import type { Metadata } from "next";
import { AdminTrips } from "@/components/admin/admin-trips";

export const metadata: Metadata = { title: "Trips" };

export default function AdminTripsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Trips</h1>
      <AdminTrips />
    </>
  );
}
