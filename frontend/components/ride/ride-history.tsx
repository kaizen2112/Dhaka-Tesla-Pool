"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { MyRideRequest } from "@/lib/types";
import { route } from "@/lib/zones";

export function RideHistory() {
  const { data, error, reload } = useApi<MyRideRequest[]>("/ride-requests/me");

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted">No rides yet.</p>
        <Link href="/passenger/request" className={buttonClasses()}>
          Request a ride
        </Link>
      </div>
    );
  }

  // Newest first — the API's order.
  return (
    <ul className="divide-y divide-border border-y border-border">
      {data.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-4 py-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{route(r.pickupZone, r.destinationZone)}</span>
            <span className="text-xs text-muted">
              {formatDateTime(r.createdAt)} · {r.seats} {r.seats === 1 ? "seat" : "seats"}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <StatusBadge status={r.status} />
            {r.membership && !r.membership.cancelledAt && (
              <span className="font-mono text-xs tabular-nums">
                {formatTaka(r.membership.farePoysha)}
                {r.status !== "COMPLETED" && <span className="text-muted"> est.</span>}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
