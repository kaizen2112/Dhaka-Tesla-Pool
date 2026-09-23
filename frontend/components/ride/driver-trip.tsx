"use client";

import Link from "next/link";
import { useState } from "react";
import { FareBreakdown, shownFare } from "@/components/ride/fare";
import { SeatsIndicator } from "@/components/ride/seats-indicator";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatTaka } from "@/lib/format";
import type { DriverPool, PoolFares, RideStatus } from "@/lib/types";
import { route } from "@/lib/zones";

// The one next step from each status (docs/ARCHITECTURE.md §3 pool transitions). Only that
// button is shown; the API still rejects anything out of order with INVALID_TRANSITION.
const NEXT_STEP: Partial<Record<RideStatus, { path: string; label: string; busy: string }>> = {
  MATCHED: { path: "arrived", label: "Mark arrived", busy: "Marking arrived…" },
  DRIVER_ARRIVED: { path: "start", label: "Start trip", busy: "Starting…" },
  STARTED: { path: "complete", label: "Complete trip", busy: "Completing…" },
};

const STATUS_LINE: Record<RideStatus, string> = {
  REQUESTED: "",
  MATCHED: "Head to the pickup. You can still add waiting passengers from the dashboard.",
  DRIVER_ARRIVED: "You're at the pickup. The pool is closed to new passengers.",
  STARTED: "Trip in progress.",
  COMPLETED: "Trip completed. Each passenger pays their own final fare.",
  CANCELLED: "Every passenger cancelled, so this trip was cancelled.",
};

export function DriverTrip({ poolId }: { poolId: string }) {
  const { data: pool, error, reload } = useApi<DriverPool>(`/pools/${poolId}`, 5000);
  // The driver gets every active passenger's breakdown (API_SPEC → GET /pools/:id/fares).
  const fares = useApi<PoolFares>(`/pools/${poolId}/fares`, 5000);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (!pool) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return <Skeleton className="h-72" />;
  }

  const step = NEXT_STEP[pool.status];
  const final = pool.status === "COMPLETED";

  async function advance(path: string) {
    if (path === "complete" && !confirm("Complete the trip? This sets everyone's final fare.")) return;
    setBusy(true);
    setActionError(null);
    try {
      await api.patch(`/pools/${poolId}/${path}`);
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setBusy(false);
      reload();
      fares.reload();
    }
  }

  return (
    <Card title={route(pool.pickupZone, pool.destinationZone)} aside={<StatusBadge status={pool.status} />}>
      <p className="text-muted">{STATUS_LINE[pool.status]}</p>

      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2">
        <dt className="text-muted">Tesla</dt>
        <dd>{pool.vehicleName}</dd>
        <dt className="text-muted">Seats</dt>
        <dd className="flex flex-wrap items-center gap-x-3">
          <SeatsIndicator occupied={pool.occupiedSeats} capacity={pool.capacity} />
          <span className="font-mono text-xs tabular-nums text-muted">
            {pool.capacity - pool.occupiedSeats} free
          </span>
        </dd>
      </dl>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-medium">Passengers</h3>
          <span className="text-xs text-muted">{final ? "Final fare" : "Estimated fare"}</span>
        </div>
        {pool.members.length === 0 ? (
          <p className="text-muted">No passengers.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {pool.members.map((m) => {
              const fare = fares.data?.fares.find((f) => f.membershipId === m.membershipId);
              return (
                <li key={m.membershipId} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{m.passengerName}</span>
                      <span className="text-xs text-muted">
                        {route(m.pickupZone, m.destinationZone)} · {m.seats} {m.seats === 1 ? "seat" : "seats"}
                      </span>
                    </div>
                    {/* Each passenger's own fare, never a split of a pool total (ARCHITECTURE §7). */}
                    <span className="font-mono tabular-nums">
                      {formatTaka(fare ? shownFare(fare, final) : m.farePoysha)}
                    </span>
                  </div>
                  {fare && (
                    // Native disclosure: no JS, keyboard and screen-reader friendly.
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted hover:text-foreground">Breakdown</summary>
                      <div className="pt-2">
                        <FareBreakdown breakdown={fare.breakdown} />
                      </div>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
      {step ? (
        <Button onClick={() => advance(step.path)} disabled={busy} className="self-start">
          {busy ? step.busy : step.label}
        </Button>
      ) : (
        <Link href="/driver/dashboard" className={buttonClasses("secondary", "md", "self-start")}>
          Back to dashboard
        </Link>
      )}
    </Card>
  );
}
