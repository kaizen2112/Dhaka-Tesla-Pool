"use client";

import { useState } from "react";
import { ROLE_LABEL } from "@/components/app-shell";
import { DriverRatingText } from "@/components/ride/feedback-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { useApi } from "@/hooks/use-api";
import { formatDateTime, formatTaka } from "@/lib/format";
import type { AdminUser, Role } from "@/lib/types";

const FILTERS: { label: string; role: Role | null }[] = [
  { label: "All", role: null },
  { label: "Passengers", role: "PASSENGER" },
  { label: "Drivers", role: "DRIVER" },
  { label: "Admins", role: "ADMIN" },
];

// Users → everyone, with what matters for their role: a driver's car, rating and open
// complaints; a passenger's wallet and rides. A real table: it's tabular data, and screen
// readers can move by row and column.
export function UserTable() {
  const [role, setRole] = useState<Role | null>(null);
  const { data, error, reload } = useApi<AdminUser[]>(`/admin/users${role ? `?role=${role}` : ""}`);

  return (
    <>
      <div role="group" aria-label="Show users" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={role === f.role ? "primary" : "secondary"}
            aria-pressed={role === f.role}
            onClick={() => setRole(f.role)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {!data ? (
        error ? <ErrorState error={error} onRetry={reload} /> : <Skeleton className="h-64" />
      ) : data.length === 0 ? (
        <p className="text-muted">No users here.</p>
      ) : (
        // Scrolls inside its own box on a phone, never the page.
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs text-muted">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">User</th>
                <th scope="col" className="px-3 py-2 font-medium">Role</th>
                <th scope="col" className="px-3 py-2 font-medium">Details</th>
                <th scope="col" className="hidden px-3 py-2 font-medium sm:table-cell">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.map((u) => (
                <tr key={u.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <div className="font-medium">{u.name}</div>
                    <div className="font-mono text-xs text-muted">{u.email}</div>
                  </td>
                  <td className="px-3 py-2.5">{ROLE_LABEL[u.role]}</td>
                  <td className="px-3 py-2.5">
                    <UserDetails user={u} />
                  </td>
                  <td className="hidden px-3 py-2.5 text-xs whitespace-nowrap text-muted sm:table-cell">
                    {formatDateTime(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function UserDetails({ user: u }: { user: AdminUser }) {
  if (u.role === "DRIVER") {
    return (
      <div className="flex flex-col gap-0.5">
        <span>
          {u.vehicle ? `${u.vehicle.name} · ${u.vehicle.capacity} seats · ${u.vehicle.isOnline ? "Online" : "Offline"}` : "No Tesla yet"}
        </span>
        <span className="text-xs">
          {u.rating && <DriverRatingText rating={u.rating} />}
          {u.openComplaints ? (
            <span className="font-medium">
              {" "}
              · {u.openComplaints} open {u.openComplaints === 1 ? "complaint" : "complaints"}
            </span>
          ) : null}
        </span>
      </div>
    );
  }
  if (u.role === "PASSENGER") {
    return (
      <span>
        <span className="font-mono tabular-nums">{formatTaka(u.walletBalancePoysha ?? 0)}</span> TeslaPay ·{" "}
        {u.rides ?? 0} {u.rides === 1 ? "ride" : "rides"}
      </span>
    );
  }
  return <span className="text-muted">—</span>;
}
