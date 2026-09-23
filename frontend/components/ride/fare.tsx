import { formatTaka } from "@/lib/format";
import type { FareBreakdown as Breakdown, PoolFares } from "@/lib/types";

// Always says which fare it is: the estimate can still change until the trip is COMPLETED
// (docs/ARCHITECTURE.md §7).
export function Fare({ poysha, final }: { poysha: number; final: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{final ? "Final fare" : "Estimated fare"}</span>
      <span className="font-mono text-3xl font-semibold tabular-nums">{formatTaka(poysha)}</span>
    </div>
  );
}

// Which figure to show for one passenger. Before COMPLETED, the stored fare is the estimate
// from when they joined; the breakdown is recomputed for who's in the pool *now* (e.g. the
// pool discount once Rafiq joins Nusrat), so it's the better estimate and it matches the
// breakdown shown under it. At COMPLETED both are the same final figure — the one paid.
export function shownFare(fare: PoolFares["fares"][number], final: boolean) {
  return final ? fare.farePoysha : fare.breakdown.farePoysha;
}

// base + distance − pool discount = total, per docs/ARCHITECTURE.md §7. Every line is already
// multiplied by the passenger's seats.
export function FareBreakdown({ breakdown: b }: { breakdown: Breakdown }) {
  const seats = b.seats > 1 ? ` × ${b.seats} seats` : "";
  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1">
      <dt className="text-muted">Base fare{seats}</dt>
      <dd className="text-right font-mono tabular-nums">{formatTaka(b.basePoysha)}</dd>
      <dt className="text-muted">
        Distance, {b.pricingKm.toFixed(1)} km{seats}
      </dt>
      <dd className="text-right font-mono tabular-nums">{formatTaka(b.distanceChargePoysha)}</dd>
      <dt className="text-muted">Pool discount</dt>
      <dd className="text-right font-mono tabular-nums">−{formatTaka(b.discountPoysha)}</dd>
      <dt className="mt-1 border-t border-border pt-2 font-medium">Total</dt>
      <dd className="mt-1 border-t border-border pt-2 text-right font-mono font-medium tabular-nums">
        {formatTaka(b.farePoysha)}
      </dd>
    </dl>
  );
}
