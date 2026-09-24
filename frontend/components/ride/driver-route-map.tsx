"use client";

import { useState } from "react";
import { StopList, ZoneMap, zonesBetween, type MapPath } from "@/components/ride/zone-map";
import type { DriverPool, PendingRequest } from "@/lib/types";
import { route, zoneName } from "@/lib/zones";

// Rider colours for the driver's map (docs/UI_GUIDE.md §2): by join order, 7 = max capacity.
export const riderColor = (i: number) => `var(--rider-${(i % 7) + 1})`;

// The driver's map: every passenger on the trip as a solid path in their colour, in parallel
// lanes along the pool's route, plus (on the dashboard) each waiting passenger's direct line,
// dashed, so the driver can see who fits before accepting.
// `highlighted` given = the parent owns the legend (the trip page's passenger list); otherwise
// this renders its own legend: hover/focus highlights a path, a tap pins it.
export function DriverRouteMap({
  pool,
  waiting = [],
  highlighted: external,
}: {
  pool?: DriverPool;
  waiting?: PendingRequest[];
  highlighted?: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const ownLegend = external === undefined;
  const highlighted = ownLegend ? (hovered ?? pinned) : external;

  const stops = pool?.stops ?? [];
  const members = pool?.members ?? [];

  const stopIndex = (membershipId: string, type: "PICKUP" | "DROPOFF") =>
    stops.findIndex((s) => s.type === type && s.riders.some((r) => r.membershipId === membershipId));
  const faded = (key: string) => highlighted != null && highlighted !== key;

  const legend = [
    ...members.map((m, i) => ({ key: m.membershipId, name: m.passengerName, color: riderColor(i), dashed: false,
      detail: `${route(m.pickupZone, m.destinationZone)} · ${m.extraKm >= 0.05 ? `+${m.extraKm.toFixed(1)} km` : "no detour"}` })),
    ...waiting.map((r, j) => ({ key: r.id, name: r.passengerName, color: riderColor(members.length + j), dashed: true,
      detail: `${route(r.pickupZone, r.destinationZone)} · waiting` })),
  ];

  const paths: MapPath[] = [
    { key: "route", zones: stops.map((s) => s.zone), color: "var(--border-strong)", width: 2 },
    ...members.map((m, i) => ({
      key: m.membershipId,
      zones: zonesBetween(stops, stopIndex(m.membershipId, "PICKUP"), stopIndex(m.membershipId, "DROPOFF")),
      color: riderColor(i),
      width: 4,
      lane: i - (members.length - 1) / 2,
      faded: faded(m.membershipId),
      label: `${m.passengerName}: ${route(m.pickupZone, m.destinationZone)}`,
    })),
    ...waiting.map((r, j) => ({
      key: r.id,
      zones: [r.pickupZone, r.destinationZone],
      color: riderColor(members.length + j),
      width: 2.5,
      dashed: true,
      faded: faded(r.id),
      label: `${r.passengerName} (waiting): ${route(r.pickupZone, r.destinationZone)}`,
    })),
  ];

  return (
    <div className="grid items-start gap-4 md:grid-cols-[24rem_1fr]">
      <ZoneMap
        label={pool ? `Route map: ${stops.length} stops` : waiting.length ? "Waiting passengers on the map" : "Map of the zones and roads"}
        description={[
          ...stops.map((s) => `${s.order}. ${zoneName(s.zone)}: ${s.type === "PICKUP" ? "pick up" : "drop off"}`),
          ...waiting.map((r) => `${r.passengerName} waiting: ${route(r.pickupZone, r.destinationZone)}`),
        ].join("; ")}
        stops={stops}
        paths={paths}
        extraZones={waiting.flatMap((r) => [r.pickupZone, r.destinationZone])}
      />
      <div className="flex flex-col gap-3">
      {legend.length === 0 && (
        <p className="text-sm text-muted">
          No trip or waiting passengers yet. Go online to see who&apos;s waiting, and where.
        </p>
      )}
      {ownLegend && legend.length > 0 && (
        <ul className="flex flex-col gap-1">
          {legend.map((item) => (
            <li key={item.key} onMouseEnter={() => setHovered(item.key)} onMouseLeave={() => setHovered(null)}>
              <button
                type="button"
                aria-pressed={pinned === item.key}
                onClick={() => setPinned((p) => (p === item.key ? null : item.key))}
                onFocus={() => setHovered(item.key)}
                onBlur={() => setHovered(null)}
                className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-foreground aria-pressed:bg-surface"
              >
                <svg width="20" height="6" aria-hidden className="shrink-0">
                  <line x1="2" y1="3" x2="18" y2="3" strokeWidth={3} strokeLinecap="round"
                    strokeDasharray={item.dashed ? "3 3" : undefined} style={{ stroke: item.color }} />
                </svg>
                <span className="font-medium">{item.name}</span>
                <span className="truncate text-xs text-muted">{item.detail}</span>
                <span className="sr-only"> — highlight on the map</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {stops.length > 0 && (
        <StopList
          items={stops.map((s) => ({
            order: s.order,
            text: `${zoneName(s.zone)} · ${s.type === "PICKUP" ? "pick up" : "drop off"} ${s.riders.map((r) => r.passengerName).join(", ")}`,
            highlight: s.riders.some((r) => r.membershipId === highlighted),
          }))}
        />
      )}
      </div>
    </div>
  );
}
