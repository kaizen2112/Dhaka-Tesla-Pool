"use client";

import Link from "next/link";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { DriverTrip } from "@/lib/types";
import { route } from "@/lib/zones";

// Riders who stayed on the trip; cancelled bookings are listed but never counted or charged.
const riding = (trip: DriverTrip) => trip.members.filter((m) => !m.cancelledAt);
const fareTotal = (trip: DriverTrip) => riding(trip).reduce((sum, m) => sum + m.farePoysha, 0);

export function DriverTrips() {
  const { data, error, reload } = useApi<DriverTrip[]>("/pools/me", 5000);

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20" />
        <Skeleton className="h-16" />
        <Skeleton className="h-16" />
      </div>
    );
  }

  if (data.length === 0) {
    return <p className="text-muted">No trips yet. Accept a waiting passenger from the dashboard to start one.</p>;
  }

  const completed = data.filter((t) => t.status === "COMPLETED");

  return (
    <>
      <StatStrip
        stats={[
          { label: "Trips completed", value: completed.length },
          { label: "Passengers carried", value: completed.reduce((sum, t) => sum + riding(t).length, 0) },
          // Each passenger's own fare, summed; the driver isn't credited in this MVP (known limitation).
          { label: "Fares", value: formatTaka(completed.reduce((sum, t) => sum + fareTotal(t), 0)) },
        ]}
      />
      <ul className="divide-y divide-border border-y border-border">
        {data.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/driver/ride/${trip.id}`}
              className="flex items-start justify-between gap-4 rounded-lg px-2 py-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-foreground"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{route(trip.pickupZone, trip.destinationZone)}</span>
                <span className="text-xs text-muted">{formatDateTime(trip.createdAt)}</span>
                <span className="text-xs text-muted">
                  {trip.members.map((m, i) => (
                    <span key={m.membershipId}>
                      {i > 0 && ", "}
                      {m.cancelledAt ? <s title="Cancelled">{m.passengerName}</s> : m.passengerName}
                    </span>
                  ))}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={trip.status} />
                {trip.status !== "CANCELLED" && (
                  <span className="font-mono text-xs tabular-nums">
                    {formatTaka(fareTotal(trip))}
                    {trip.status !== "COMPLETED" && <span className="text-muted"> est.</span>}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
