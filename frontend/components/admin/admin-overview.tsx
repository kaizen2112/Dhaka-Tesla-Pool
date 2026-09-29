"use client";

import Link from "next/link";
import { ComplaintCard } from "@/components/admin/complaint-queue";
import { buttonClasses } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { Toast } from "@/components/ui/toast";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { formatTaka } from "@/lib/format";
import type { AdminComplaint, AdminOverview as Overview } from "@/lib/types";

const POLL_MS = 10000;
const LATEST = 5;

// The admin's home: people, trips and money at a glance, then what needs a decision.
export function AdminOverview() {
  const overview = useApi<Overview>("/admin/overview", POLL_MS);
  const open = useApi<AdminComplaint[]>("/admin/complaints?status=OPEN", POLL_MS);
  const [toast, showToast] = useToast();

  if (!overview.data) {
    if (overview.error) return <ErrorState error={overview.error} onRetry={overview.reload} />;
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const o = overview.data;
  return (
    <>
      <div className="flex flex-col gap-3">
        <StatStrip
          stats={[
            { label: "Passengers", value: o.users.passengers },
            { label: "Drivers", value: o.users.drivers },
            { label: "Drivers online", value: o.driversOnline },
          ]}
        />
        <StatStrip
          stats={[
            { label: "Active trips", value: o.activePools },
            { label: "Completed today", value: o.tripsCompletedToday },
            { label: "Collected", value: formatTaka(o.collectedPoysha) },
          ]}
        />
      </div>

      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">
            Open complaints <span className="font-mono text-muted tabular-nums">{o.openComplaints}</span>
          </h2>
          {o.openComplaints > LATEST && (
            <Link href="/admin/complaints" className={buttonClasses("ghost", "sm")}>
              See all
            </Link>
          )}
        </div>
        {!open.data ? (
          open.error ? <ErrorState error={open.error} onRetry={open.reload} /> : <Skeleton className="h-40" />
        ) : open.data.length === 0 ? (
          <p className="text-muted">No open complaints. Nothing to review.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {open.data.slice(0, LATEST).map((c) => (
              <li key={c.id}>
                <ComplaintCard
                  complaint={c}
                  onChange={(text) => {
                    if (text) showToast(text);
                    open.reload();
                    overview.reload();
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toast message={toast} />
    </>
  );
}
