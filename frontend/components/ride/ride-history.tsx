"use client";

import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { MyRideRequest } from "@/lib/types";
import { route } from "@/lib/zones";

// What the fare column says: final and how it was paid, or still an estimate.
function paymentNote(r: MyRideRequest) {
  const m = r.membership;
  if (!m || m.cancelledAt) return null;
  if (r.status !== "COMPLETED") return "Estimate";
  if (!m.paidAt) return "Unpaid";
  return m.paymentMethod === "WALLET" ? "Paid · TeslaPay" : "Paid · cash";
}

export function RideHistory() {
  const { data, error, reload } = useApi<MyRideRequest[]>("/ride-requests/me");

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-20" />
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

  const completed = data.filter((r) => r.status === "COMPLETED");
  // Only money that actually left: paid, final fares.
  const spent = completed.reduce((sum, r) => sum + (r.membership?.paidAt ? r.membership.farePoysha : 0), 0);

  // Newest first — the API's order.
  return (
    <>
      <StatStrip
        stats={[
          { label: "Rides taken", value: completed.length },
          { label: "Total spent", value: formatTaka(spent) },
          { label: "Cancelled", value: data.filter((r) => r.status === "CANCELLED").length },
        ]}
      />
      <ul className="divide-y divide-border border-y border-border">
        {data.map((r) => {
          const note = paymentNote(r);
          return (
            <li key={r.id} className="flex items-start justify-between gap-4 py-3">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{route(r.pickupZone, r.destinationZone)}</span>
                <span className="text-xs text-muted">
                  {formatDateTime(r.createdAt)} · {r.seats} {r.seats === 1 ? "seat" : "seats"}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <StatusBadge status={r.status} />
                {r.membership && note && (
                  <span className="font-mono text-xs tabular-nums">{formatTaka(r.membership.farePoysha)}</span>
                )}
                {note && <span className="text-xs text-muted">{note}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
