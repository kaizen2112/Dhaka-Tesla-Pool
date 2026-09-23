import type { Metadata } from "next";
import Link from "next/link";
import { DriverTrip } from "@/components/ride/driver-trip";

export const metadata: Metadata = { title: "Trip" };

export default async function DriverTripPage({ params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href="/driver/dashboard" className="text-xs text-muted hover:text-foreground">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Trip</h1>
      </div>
      <DriverTrip poolId={poolId} />
    </>
  );
}
