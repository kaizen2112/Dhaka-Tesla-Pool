"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { Membership, PaymentMethod, Wallet } from "@/lib/types";

// Shown once the trip is COMPLETED. The API is what makes paying safe: one transaction, a
// conditional update on paidAt (ALREADY_PAID) and on the balance (INSUFFICIENT_FUNDS).
export function PaymentPanel({ membership, onPaid }: { membership: Membership; onPaid: () => void }) {
  const wallet = useApi<Wallet>("/wallet/me");
  const [paying, setPaying] = useState<PaymentMethod | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fare = formatTaka(membership.farePoysha);
  const balance = wallet.data ? formatTaka(wallet.data.balancePoysha) : "—";

  async function pay(method: PaymentMethod) {
    setPaying(method);
    setError(null);
    try {
      await api.post(`/payments/${membership.id}`, { method });
    } catch (err) {
      setError(
        errorMessage(err, {
          INSUFFICIENT_FUNDS: `Your TeslaPay balance (${balance}) doesn't cover ${fare}. Pay with cash instead.`,
          // Most likely paid from another tab a moment ago; the refresh below shows the receipt.
          ALREADY_PAID: "This ride is already paid.",
        }),
      );
    } finally {
      setPaying(null);
      wallet.reload();
      onPaid();
    }
  }

  if (membership.paidAt) {
    return (
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        <p className="font-medium">
          Paid {fare} {membership.paymentMethod === "WALLET" ? "with TeslaPay" : "in cash"}
        </p>
        <p className="text-xs text-muted">
          {formatDateTime(membership.paidAt)}
          {membership.paymentMethod === "WALLET" && (
            <>
              {" "}
              · TeslaPay balance <span className="font-mono tabular-nums">{balance}</span>
            </>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium">Pay {fare}</span>
        <span className="text-xs text-muted">
          TeslaPay balance <span className="font-mono tabular-nums">{balance}</span>
        </span>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => pay("WALLET")} disabled={paying !== null}>
          {paying === "WALLET" ? "Paying…" : "Pay with TeslaPay"}
        </Button>
        <Button variant="secondary" onClick={() => pay("CASH")} disabled={paying !== null}>
          {paying === "CASH" ? "Paying…" : "Pay in cash"}
        </Button>
      </div>
    </div>
  );
}
