"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Fare } from "@/components/ride/fare";
import { SeatsIndicator } from "@/components/ride/seats-indicator";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage, waitReason } from "@/lib/errors";
import type { CreateRideResponse } from "@/lib/types";
import { ZONE_NAMES, route } from "@/lib/zones";

const ZONE_OPTIONS = Object.entries(ZONE_NAMES).map(([code, name]) => (
  <option key={code} value={code}>
    {name}
  </option>
));

export function RideRequestForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [sameZone, setSameZone] = useState(false);
  const [result, setResult] = useState<CreateRideResponse | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      pickupZone: String(form.get("pickupZone")),
      destinationZone: String(form.get("destinationZone")),
      seats: Number(form.get("seats")),
    };
    // Caught here for a clearer message; the API rejects it too.
    setSameZone(body.pickupZone === body.destinationZone);
    if (body.pickupZone === body.destinationZone) return;

    setPending(true);
    setError(null);
    try {
      setResult(await api.post<CreateRideResponse>("/ride-requests", body));
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }

  if (result) return <RequestResult result={result} />;

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Select label="Pickup" name="pickupZone" defaultValue="BANANI" required>
        {ZONE_OPTIONS}
      </Select>
      <Select
        label="Destination"
        name="destinationZone"
        defaultValue=""
        required
        error={sameZone ? "Pick a destination different from your pickup." : undefined}
      >
        <option value="" disabled>
          Choose a zone
        </option>
        {ZONE_OPTIONS}
      </Select>
      <Select label="Seats" name="seats" defaultValue="1">
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </Select>

      {error !== null && (
        <p role="alert" className="text-sm text-danger">
          {errorMessage(error)}{" "}
          {error instanceof ApiError && error.code === "ACTIVE_REQUEST_EXISTS" && (
            <Link href="/passenger/dashboard" className="font-medium underline underline-offset-4">
              See your ride
            </Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Requesting…" : "Request ride"}
      </Button>
    </form>
  );
}

function RequestResult({ result }: { result: CreateRideResponse }) {
  const { request, pool, matchResult, estimatedFarePoysha } = result;
  return (
    <Card title={route(request.pickupZone, request.destinationZone)} aside={<StatusBadge status={request.status} />}>
      {pool ? (
        <>
          <p>You&apos;re in {pool.vehicleName}.</p>
          <SeatsIndicator occupied={pool.occupiedSeats} capacity={pool.capacity} />
        </>
      ) : (
        <p className="text-muted">{!matchResult.matched && waitReason(matchResult.reason)}</p>
      )}
      <Fare poysha={estimatedFarePoysha} final={false} />
      <Link href="/passenger/dashboard" className={buttonClasses("primary", "md", "w-full")}>
        Follow your ride
      </Link>
    </Card>
  );
}
