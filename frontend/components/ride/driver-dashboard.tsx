"use client";

import Link from "next/link";
import { useState } from "react";
import { VehicleForm } from "@/components/forms/vehicle-form";
import { SeatsIndicator } from "@/components/ride/seats-indicator";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { MyVehicle, PendingRequest } from "@/lib/types";
import { route } from "@/lib/zones";

const POLL_MS = 5000;

export function DriverDashboard() {
  const vehicle = useApi<MyVehicle>("/vehicles/me", POLL_MS);
  const v = vehicle.data;
  // The API returns [] for an offline vehicle anyway; skipping the call just saves a request.
  const pending = useApi<PendingRequest[]>(v?.isOnline ? "/ride-requests/pending" : null, POLL_MS);

  if (!v) {
    if (vehicle.error instanceof ApiError && vehicle.error.code === "NOT_FOUND") {
      return <VehicleForm onCreated={vehicle.reload} />;
    }
    if (vehicle.error) return <ErrorState error={vehicle.error} onRetry={vehicle.reload} />;
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const refresh = () => {
    vehicle.reload();
    pending.reload();
  };

  return (
    <>
      <VehicleCard vehicle={v} onChange={refresh} />
      {v.activePool && <ActivePoolCard pool={v.activePool} />}
      <PendingCard vehicle={v} pending={pending} onAccepted={refresh} />
    </>
  );
}

function VehicleCard({ vehicle, onChange }: { vehicle: MyVehicle; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const online = vehicle.isOnline;

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      await api.patch("/vehicles/me/status", { isOnline: !online });
      onChange();
    } catch (err) {
      setError(
        errorMessage(err, {
          ACTIVE_POOL_EXISTS: "You can't go offline during a trip. Complete it first, then go offline.",
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card
      title={vehicle.name}
      aside={<span className="font-mono text-xs tabular-nums text-muted">{vehicle.capacity} seats</span>}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="flex items-center gap-2">
          <span
            aria-hidden
            className={`size-2.5 rounded-full ${online ? "bg-foreground" : "border border-border-strong"}`}
          />
          {online ? "Online — you can accept rides." : "Offline — go online to accept rides."}
        </p>
        {/* Primary only while offline: then going online is the one thing to do here. */}
        <Button variant={online ? "secondary" : "primary"} onClick={toggle} disabled={busy} className="shrink-0">
          {busy ? (online ? "Going offline…" : "Going online…") : online ? "Go offline" : "Go online"}
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Card>
  );
}

function ActivePoolCard({ pool }: { pool: NonNullable<MyVehicle["activePool"]> }) {
  return (
    <Card title="Current trip" aside={<StatusBadge status={pool.status} />}>
      <p>{route(pool.pickupZone, pool.destinationZone)}</p>
      <SeatsIndicator occupied={pool.occupiedSeats} capacity={pool.capacity} />
      <Link href={`/driver/ride/${pool.id}`} className={buttonClasses("primary", "md", "self-start")}>
        Open trip
      </Link>
    </Card>
  );
}

function PendingCard({
  vehicle,
  pending,
  onAccepted,
}: {
  vehicle: MyVehicle;
  pending: ReturnType<typeof useApi<PendingRequest[]>>;
  onAccepted: () => void;
}) {
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const pool = vehicle.activePool;

  async function accept(id: string) {
    setAcceptingId(id);
    setRowError(null);
    try {
      await api.patch(`/ride-requests/${id}/accept`);
    } catch (err) {
      setRowError({
        id,
        message: errorMessage(err, { INVALID_TRANSITION: "This passenger is no longer waiting." }),
      });
    } finally {
      setAcceptingId(null);
      onAccepted();
    }
  }

  let body;
  if (!vehicle.isOnline) {
    body = <p className="text-muted">Go online to see passengers waiting for a ride.</p>;
  } else if (pool && pool.status !== "MATCHED") {
    body = <p className="text-muted">Your current trip isn&apos;t taking more passengers.</p>;
  } else if (!pending.data) {
    body = pending.error ? (
      <ErrorState error={pending.error} onRetry={pending.reload} />
    ) : (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  } else if (pending.data.length === 0) {
    body = <p className="text-muted">No one is waiting right now. This list refreshes by itself.</p>;
  } else {
    body = (
      <ul className="divide-y divide-border">
        {pending.data.map((r) => (
          <li key={r.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{r.passengerName}</span>
                <span className="text-xs text-muted">
                  {route(r.pickupZone, r.destinationZone)} · {r.seats} {r.seats === 1 ? "seat" : "seats"} ·
                  since {formatDateTime(r.createdAt)}
                </span>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => accept(r.id)}
                disabled={acceptingId !== null}
                className="shrink-0"
              >
                {acceptingId === r.id ? "Accepting…" : pool ? "Add to trip" : "Accept"}
              </Button>
            </div>
            {rowError?.id === r.id && (
              <p role="alert" className="text-xs text-danger">
                {rowError.message}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card title="Waiting passengers">
      {pool?.status === "MATCHED" && vehicle.isOnline && (
        <p className="text-xs text-muted">Showing requests that fit your free seats.</p>
      )}
      {body}
    </Card>
  );
}
