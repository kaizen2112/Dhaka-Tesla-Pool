"use client";

import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { MyRideRequest, Wallet } from "@/lib/types";
import { route } from "@/lib/zones";

// TeslaPay: the simulated wallet (docs/DATABASE.md → Wallet). Read-only here; paying happens
// on the ride card once a trip is COMPLETED.
export function WalletView() {
  const wallet = useApi<Wallet>("/wallet/me");
  // Only to name the ride behind each payment; the wallet still renders without it.
  const rides = useApi<MyRideRequest[]>("/ride-requests/me");

  if (!wallet.data) {
    if (wallet.error) return <ErrorState error={wallet.error} onRetry={wallet.reload} />;
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const rideFor = new Map(
    (rides.data ?? []).flatMap((r) => (r.membership ? [[r.membership.id, r] as const] : [])),
  );
  const { balancePoysha, transactions } = wallet.data;

  return (
    <>
      <Card title="TeslaPay balance">
        <span className="font-mono text-4xl font-semibold tabular-nums">{formatTaka(balancePoysha)}</span>
        <p className="text-xs text-muted">Simulated wallet. No top-ups in this MVP.</p>
      </Card>

      <section className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">Transactions</h2>
          {transactions.length > 0 && <span className="text-xs text-muted">Latest 20</span>}
        </div>
        {transactions.length === 0 ? (
          <p className="text-muted">No transactions yet.</p>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {transactions.map((t) => {
              const ride = t.poolMembershipId ? rideFor.get(t.poolMembershipId) : undefined;
              const credit = t.type === "CREDIT";
              return (
                <li key={t.id} className="flex items-start justify-between gap-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-medium">
                      {t.poolMembershipId ? "Ride payment" : credit ? "Top-up" : "Debit"}
                    </span>
                    <span className="text-xs text-muted">
                      {formatDateTime(t.createdAt)}
                      {ride && ` · ${route(ride.pickupZone, ride.destinationZone)}`}
                    </span>
                  </div>
                  {/* Sign and word, not colour, carry the direction (docs/UI_GUIDE.md §1). */}
                  <span className="shrink-0 font-mono tabular-nums">
                    {credit ? "+" : "−"}
                    {formatTaka(t.amountPoysha)}
                    <span className="sr-only">{credit ? " credited" : " debited"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
