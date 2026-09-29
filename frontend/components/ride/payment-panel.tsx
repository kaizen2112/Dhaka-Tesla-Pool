"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Section } from "@/components/ui/section";
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
  const [dialog, confirm] = useConfirm();

  // Money moves: say exactly what will happen before it does.
  function confirmPayment(method: PaymentMethod) {
    if (method === "CASH") {
      return confirm({
        title: `Pay ${fare} in cash?`,
        message: "Confirm once you've handed the cash to your driver. It's recorded as paid straight away.",
        confirmLabel: `Paid ${fare} in cash`,
      });
    }
    const left = wallet.data ? wallet.data.balancePoysha - membership.farePoysha : null;
    return confirm({
      title: `Pay ${fare} with TeslaPay?`,
      message:
        left === null ? (
          "It's taken from your TeslaPay balance."
        ) : (
          <>
            Your balance goes from <span className="font-mono tabular-nums">{balance}</span> to{" "}
            <span className="font-mono tabular-nums">{formatTaka(left)}</span>.
          </>
        ),
      confirmLabel: `Pay ${fare}`,
    });
  }

  async function pay(method: PaymentMethod) {
    // Not enough balance: say so now, instead of a dialog whose only honest answer is "no".
    // (The API still decides: it rejects with INSUFFICIENT_FUNDS if the balance changed meanwhile.)
    if (method === "WALLET" && wallet.data && wallet.data.balancePoysha < membership.farePoysha) {
      setError(`Your TeslaPay balance (${balance}) doesn't cover ${fare}. Pay in cash instead.`);
      return;
    }
    if (!(await confirmPayment(method))) return;
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
      <Section icon="wallet" title={`Paid ${fare} ${membership.paymentMethod === "WALLET" ? "with TeslaPay" : "in cash"}`}>
        <p className="text-xs text-muted">
          {formatDateTime(membership.paidAt)}
          {membership.paymentMethod === "WALLET" && (
            <>
              {" "}
              · TeslaPay balance <span className="font-mono tabular-nums">{balance}</span>
            </>
          )}
        </p>
      </Section>
    );
  }

  return (
    <Section
      icon="wallet"
      title={`Pay ${fare}`}
      aside={
        <span className="ml-auto text-xs text-muted">
          TeslaPay balance <span className="font-mono tabular-nums">{balance}</span>
        </span>
      }
    >
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
      {dialog}
    </Section>
  );
}
