"use client";

import Link from "next/link";
import { useState } from "react";
import { Fare } from "@/components/ride/fare";
import { SeatsIndicator } from "@/components/ride/seats-indicator";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { MyRideRequest, RideRequestDetail, RideStatus } from "@/lib/types";
import { route, zoneName } from "@/lib/zones";

const POLL_MS = 5000;
const ACTIVE: RideStatus[] = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED", "STARTED"];
// docs/ARCHITECTURE.md §3: a passenger can cancel until the trip starts.
const CANCELLABLE: RideStatus[] = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED"];

// The ride to show: the newest request while it's active, or once it's completed but unpaid
// (so the final fare stays on screen). Only one request can be active at a time.
function currentRide(requests: MyRideRequest[]) {
  const latest = requests[0];
  if (!latest) return null;
  if (ACTIVE.includes(latest.status)) return latest;
  if (latest.status === "COMPLETED" && !latest.membership?.paidAt) return latest;
  return null;
}

export function PassengerDashboard() {
  const list = useApi<MyRideRequest[]>("/ride-requests/me", POLL_MS);
  const current = list.data ? currentRide(list.data) : null;
  const detail = useApi<RideRequestDetail>(current ? `/ride-requests/${current.id}` : null, POLL_MS);

  if (!list.data) {
    return list.error ? <ErrorState error={list.error} onRetry={list.reload} /> : <Skeleton className="h-56" />;
  }

  if (!current) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-muted">No ride in progress.</p>
        <Link href="/passenger/request" className={buttonClasses()}>
          Request a ride
        </Link>
      </div>
    );
  }

  if (!detail.data) {
    return detail.error ? <ErrorState error={detail.error} onRetry={detail.reload} /> : <Skeleton className="h-56" />;
  }

  return (
    <RideCard
      key={detail.data.request.id}
      ride={detail.data}
      onChange={() => {
        list.reload();
        detail.reload();
      }}
    />
  );
}

function statusLine({ request, pool }: RideRequestDetail) {
  switch (request.status) {
    case "REQUESTED":
      return "Waiting for a driver to accept your request.";
    case "MATCHED":
      return `${pool?.driverName} is on the way to ${zoneName(request.pickupZone)}.`;
    case "DRIVER_ARRIVED":
      return `${pool?.driverName} has arrived at the pickup.`;
    case "STARTED":
      return `On the way to ${zoneName(request.destinationZone)}.`;
    case "COMPLETED":
      return "You've arrived.";
    case "CANCELLED":
      return "This ride was cancelled.";
  }
}

function RideCard({ ride, onChange }: { ride: RideRequestDetail; onChange: () => void }) {
  const { request, membership, pool } = ride;
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function cancel() {
    if (!confirm("Cancel this ride? Your seat goes back to the pool.")) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.patch(`/ride-requests/${request.id}/cancel`);
      onChange();
    } catch (err) {
      // Usually INVALID_TRANSITION: the driver started the trip a moment ago.
      setActionError(errorMessage(err));
      onChange();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <Card title={route(request.pickupZone, request.destinationZone)} aside={<StatusBadge status={request.status} />}>
      <p className="text-muted">{statusLine(ride)}</p>

      {pool && (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2">
          <dt className="text-muted">Tesla</dt>
          <dd>
            {pool.vehicleName} · {pool.driverName}
          </dd>
          <dt className="text-muted">Seats</dt>
          <dd>
            <SeatsIndicator occupied={pool.occupiedSeats} capacity={pool.capacity} />
          </dd>
          <dt className="text-muted">Riding with</dt>
          <dd>{pool.coRiders.length ? pool.coRiders.join(", ") : "Just you so far"}</dd>
          <dt className="text-muted">Your booking</dt>
          <dd className="font-mono tabular-nums">
            {request.seats} {request.seats === 1 ? "seat" : "seats"}
          </dd>
        </dl>
      )}

      {membership && <Fare poysha={membership.farePoysha} final={request.status === "COMPLETED"} />}

      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}
      {CANCELLABLE.includes(request.status) && (
        <Button variant="danger" onClick={cancel} disabled={cancelling} className="self-start">
          {cancelling ? "Cancelling…" : "Cancel ride"}
        </Button>
      )}
    </Card>
  );
}
