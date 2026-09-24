"use client";

import Link from "next/link";
import { useState } from "react";
import { Fare, FareBreakdown, shownFare } from "@/components/ride/fare";
import { LifecycleStepper } from "@/components/ride/lifecycle-stepper";
import { PaymentPanel } from "@/components/ride/payment-panel";
import { initialOf, SeatMap, type Seat } from "@/components/ride/seat-map";
import { StatusTimeline } from "@/components/ride/status-timeline";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { Toast } from "@/components/ui/toast";
import { useApi } from "@/hooks/use-api";
import { useChangeToast } from "@/hooks/use-change-toast";
import { api } from "@/lib/api-client";
import { errorMessage, waitReason } from "@/lib/errors";
import { formatTaka } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { MyRideRequest, PoolFares, RideRequestDetail, RideStatus } from "@/lib/types";
import { route, zoneName } from "@/lib/zones";

const POLL_MS = 5000;
const ACTIVE: RideStatus[] = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED", "STARTED"];
// docs/ARCHITECTURE.md §3: a passenger can cancel until the trip starts.
const CANCELLABLE: RideStatus[] = ["REQUESTED", "MATCHED", "DRIVER_ARRIVED"];

// The ride to show: the newest request while it's active, or once it's completed (to pay,
// then as a receipt until the next booking). Only one request can be active at a time.
function currentRide(requests: MyRideRequest[]) {
  const latest = requests[0];
  if (latest && (ACTIVE.includes(latest.status) || latest.status === "COMPLETED")) return latest;
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

function statusLine({ request, pool, waiting }: RideRequestDetail) {
  switch (request.status) {
    case "REQUESTED":
      return waiting ? waitReason(waiting.reason) : "Waiting for a driver to accept your request.";
    case "MATCHED":
      return `${pool?.driverName} is on the way to ${zoneName(request.pickupZone)}.`;
    case "DRIVER_ARRIVED":
      return `${pool?.driverName} has arrived at the pickup.`;
    case "STARTED":
      return `On the way to ${zoneName(request.destinationZone)}.`;
    case "COMPLETED":
      return "You've arrived. Each passenger pays their own fare.";
    case "CANCELLED":
      return "This ride was cancelled.";
  }
}

// What changed between two polls, told to the passenger. Their own status first, then who
// got in or out of the Tesla.
interface RideSnapshot {
  status: RideStatus;
  coRiders: string[];
}

function rideChange(before: RideSnapshot, after: RideSnapshot, driver = "Your driver") {
  if (before.status !== after.status) {
    switch (after.status) {
      case "MATCHED":
        return `${driver} accepted your ride`;
      case "DRIVER_ARRIVED":
        return `${driver} has arrived at the pickup`;
      case "STARTED":
        return "Your trip has started";
      case "COMPLETED":
        return "You've arrived. Time to pay";
      case "CANCELLED":
        return "Your ride was cancelled";
      default:
        return null;
    }
  }
  const joined = after.coRiders.find((n) => !before.coRiders.includes(n));
  if (joined) return `${joined} joined your pool`;
  const left = before.coRiders.find((n) => !after.coRiders.includes(n));
  return left ? `${left} left the pool` : null;
}

// Your seats filled (you), co-riders outlined with their initial. Co-riders' seat counts aren't
// in the passenger view, so any extra seats they booked show as taken but unlabelled.
function passengerSeats(ride: RideRequestDetail, me: string): Seat[] {
  const { request, pool } = ride;
  if (!pool) return [];
  const seats: Seat[] = [
    ...Array.from({ length: request.seats }, () => ({ initial: initialOf(me || "You"), name: "You", emphasis: true })),
    ...pool.coRiders.map((name) => ({ initial: initialOf(name), name })),
  ];
  while (seats.length < pool.occupiedSeats) seats.push({ initial: "", name: "Taken" });
  return seats.slice(0, pool.capacity);
}

function RideCard({ ride, onChange }: { ride: RideRequestDetail; onChange: () => void }) {
  const { request, membership, pool, waiting } = ride;
  const me = useSession()?.user.name ?? "";
  const final = request.status === "COMPLETED";
  const toast = useChangeToast({ status: request.status, coRiders: pool?.coRiders ?? [] }, (before, after) =>
    rideChange(before, after, pool?.driverName),
  );
  // A passenger sees only their own entry (API_SPEC → GET /pools/:id/fares).
  const fares = useApi<PoolFares>(pool ? `/pools/${pool.id}/fares` : null, POLL_MS);
  const ownFare = fares.data?.fares[0];
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
      <LifecycleStepper status={request.status} />

      {/* Waiting: no pool yet, so the solo estimate from the API (docs/API_SPEC.md → waiting). */}
      {request.status === "REQUESTED" && waiting && <Fare poysha={waiting.estimatedFarePoysha} final={false} />}

      {pool && (
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-6 gap-y-2">
          <dt className="text-muted">Tesla</dt>
          <dd>
            {pool.vehicleName} · {pool.driverName}
          </dd>
          <dt className="text-muted">Seats</dt>
          <dd>
            <SeatMap capacity={pool.capacity} seats={passengerSeats(ride, me)} />
          </dd>
          <dt className="text-muted">Riding with</dt>
          <dd>{pool.coRiders.length ? pool.coRiders.join(", ") : "Just you so far"}</dd>
          <dt className="text-muted">Your booking</dt>
          <dd className="font-mono tabular-nums">
            {request.seats} {request.seats === 1 ? "seat" : "seats"}
          </dd>
        </dl>
      )}

      {membership && (
        <div className="flex flex-col gap-3">
          <Fare poysha={ownFare ? shownFare(ownFare, final) : membership.farePoysha} final={final} />
          {ownFare && ownFare.breakdown.discountPoysha > 0 && (
            <p className="text-sm font-medium">
              Saved <span className="font-mono tabular-nums">{formatTaka(ownFare.breakdown.discountPoysha)}</span> by
              pooling
            </p>
          )}
          {ownFare && <FareBreakdown breakdown={ownFare.breakdown} />}
        </div>
      )}
      {final && membership && <PaymentPanel membership={membership} onPaid={onChange} />}
      {final && membership?.paidAt && (
        <Link href="/passenger/request" className={buttonClasses("primary", "md", "self-start")}>
          Request another ride
        </Link>
      )}

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

      {/* The passenger's history view: pool rows + their own request's rows, so every
          request row is theirs. */}
      {pool && (
        <StatusTimeline poolId={pool.id} names={{ viewer: me, driver: pool.driverName, rider: () => me }} />
      )}
      <Toast message={toast} />
    </Card>
  );
}
