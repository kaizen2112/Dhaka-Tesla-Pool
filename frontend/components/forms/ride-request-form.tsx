"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Fare } from "@/components/ride/fare";
import { SeatsIndicator } from "@/components/ride/seats-indicator";
import { ZoneMap } from "@/components/ride/zone-map";
import { Button, buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useApi } from "@/hooks/use-api";
import { ApiError, api } from "@/lib/api-client";
import { errorMessage, waitReason } from "@/lib/errors";
import { formatTaka } from "@/lib/format";
import type { CreateRideResponse, FareEstimate } from "@/lib/types";
import { ZONE_NAMES, route, zoneName } from "@/lib/zones";

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
  // Mirrors the (uncontrolled) fields for the live preview; the submit still reads the form.
  const [choice, setChoice] = useState({ pickup: "BANANI", destination: "", seats: 1 });

  function onFormChange(event: FormEvent<HTMLFormElement>) {
    const form = new FormData(event.currentTarget);
    setChoice({
      pickup: String(form.get("pickupZone")),
      destination: String(form.get("destinationZone") ?? ""),
      seats: Number(form.get("seats")),
    });
  }

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
    <form onSubmit={onSubmit} onChange={onFormChange} className="flex flex-col gap-4">
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

      <RequestPreview {...choice} />

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

// Live preview while choosing (docs/UI_UX_PLAN.md §4.1): the direct line on the zone map, and
// the solo quote from GET /fares/estimate. Debounced, and purely informational — if the quote
// fails, the form still works and the booking response has the fare anyway.
function RequestPreview({ pickup, destination, seats }: { pickup: string; destination: string; seats: number }) {
  const ready = destination !== "" && destination !== pickup;
  const wanted = ready
    ? `/fares/estimate?pickupZone=${pickup}&destinationZone=${destination}&seats=${seats}`
    : null;
  const [path, setPath] = useState<string | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setPath(wanted), 300);
    return () => clearTimeout(timer);
  }, [wanted]);
  const estimate = useApi<FareEstimate>(path);

  const stops = [
    { order: 1, zone: pickup, type: "PICKUP" as const, highlight: true },
    ...(ready ? [{ order: 2, zone: destination, type: "DROPOFF" as const, highlight: true }] : []),
  ];

  return (
    <div className="grid items-start gap-4 md:grid-cols-[24rem_1fr]">
      <ZoneMap
        label={ready ? `Preview: ${route(pickup, destination)}` : `Preview: pickup at ${zoneName(pickup)}`}
        description="Your pickup and destination, joined by the road route the fare is priced on."
        stops={stops}
        paths={ready ? [{ key: "direct", zones: [pickup, destination], color: "var(--accent)", width: 4 }] : []}
      />
      <p className="text-sm text-muted" aria-live="polite">
        {!ready ? (
          "Choose a destination to see the distance and fare."
        ) : estimate.data && path === wanted ? (
          <>
            <span className="font-mono tabular-nums text-foreground">{estimate.data.directKm.toFixed(1)} km</span>{" "}
            by road · about{" "}
            <span className="font-mono tabular-nums text-foreground">
              {formatTaka(estimate.data.breakdown.farePoysha)}
            </span>{" "}
            alone. Sharing a Tesla lowers it.
          </>
        ) : estimate.error && path === wanted ? (
          "Couldn't get a fare estimate. You can still request the ride."
        ) : (
          "Estimating…"
        )}
      </p>
    </div>
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
