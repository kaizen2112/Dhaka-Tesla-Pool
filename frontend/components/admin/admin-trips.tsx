"use client";

import { TripRow } from "@/components/ride/driver-trips";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { useApi } from "@/hooks/use-api";
import type { DriverTrip } from "@/lib/types";

// Trips → every driver's latest 50, the same rows the driver sees, plus who drove.
// Read-only: the admin can't move a trip along or change a fare.
export function AdminTrips() {
  const { data, error, reload } = useApi<DriverTrip[]>("/admin/pools", 10000);

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (data.length === 0) return <p className="text-muted">No trips yet.</p>;

  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((trip) => (
        <li key={trip.id}>
          <TripRow trip={trip} showDriver />
        </li>
      ))}
    </ul>
  );
}
