"use client";

import { useApi } from "@/hooks/use-api";
import type { HistoryEntry } from "@/lib/types";

const POLL_MS = 5000;

interface Names {
  viewer: string; // said as "You"
  driver: string; // the pool's driver: a REQUESTED → MATCHED by them is an accept, not a join
  rider: (rideRequestId: string) => string | undefined; // who a request belongs to, if known
}

// One sentence per RideStatusHistory row (GET /pools/:id/history), or null to skip it.
// A pool step is logged once for the pool and once per rider's request; only the pool row is
// told, so "Jashim started the trip" doesn't repeat for every passenger.
function describe(e: HistoryEntry, names: Names): string | null {
  const you = (name: string) => (name === names.viewer ? "You" : name);
  const actor = you(e.actor.name);

  if (!e.rideRequestId) {
    switch (e.toStatus) {
      case "DRIVER_ARRIVED":
        return `${actor} arrived at the pickup`;
      case "STARTED":
        return `${actor} started the trip`;
      case "COMPLETED":
        return `${actor} completed the trip — fares are final`;
      case "CANCELLED":
        return "Trip cancelled — no passengers left";
      default:
        return null; // pool created: the accept row below already says it
    }
  }

  const rider = names.rider(e.rideRequestId);
  switch (e.toStatus) {
    case "REQUESTED":
      return `${actor} requested a ride`;
    case "MATCHED":
      if (e.actor.name !== names.driver) return `${actor} joined the pool`;
      return `${actor} accepted ${rider === names.viewer ? "your ride" : (rider ?? "a passenger")}`;
    case "CANCELLED":
      return `${actor} cancelled ${actor === "You" ? "your" : "their"} ride`;
    default:
      return null;
  }
}

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

// The audit trail, told as sentences. Collapsed by default: <details> needs no JS, and it's
// keyboard and screen-reader friendly.
export function StatusTimeline({ poolId, names }: { poolId: string; names: Names }) {
  const { data } = useApi<HistoryEntry[]>(`/pools/${poolId}/history`, POLL_MS);
  const lines = (data ?? []).flatMap((e) => {
    const text = describe(e, names);
    return text ? [{ id: e.id, at: e.changedAt, text }] : [];
  });

  return (
    <details className="text-sm">
      <summary className="cursor-pointer text-muted hover:text-foreground">
        Timeline{lines.length > 0 && <span className="font-mono tabular-nums"> · {lines.length}</span>}
      </summary>
      {!data ? (
        <p className="pt-3 text-xs text-muted">Loading…</p>
      ) : (
        <ol className="flex flex-col gap-2 border-l border-border pt-3 pl-4">
          {lines.map((line) => (
            <li key={line.id} className="relative flex gap-3">
              <span aria-hidden className="absolute top-1.5 -left-[19px] size-1.5 rounded-full bg-foreground" />
              <time dateTime={line.at} className="shrink-0 font-mono text-xs tabular-nums text-muted">
                {time(line.at)}
              </time>
              <span>{line.text}</span>
            </li>
          ))}
        </ol>
      )}
    </details>
  );
}
