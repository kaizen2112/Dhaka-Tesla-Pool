"use client";

import { CATEGORY_LABELS, ComplaintStatusBadge, Stars } from "@/components/ride/feedback-panel";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { useApi } from "@/hooks/use-api";
import { formatDateTime } from "@/lib/format";
import type { DriverProfile as Profile } from "@/lib/types";

const STAR_VALUES = [5, 4, 3, 2, 1] as const;

// What passengers said about the driver (docs/API_SPEC.md → GET /drivers/me/profile). The API
// never sends who said it, so there are no names to hide here.
export function DriverProfile() {
  const { data, error, reload } = useApi<Profile>("/drivers/me/profile");

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  const { driver, rating, reviews, complaints } = data;
  const open = complaints.filter((c) => c.status === "OPEN").length;

  return (
    <>
      <p className="-mt-4 text-muted">
        {driver.name}
        {driver.vehicleName && ` · ${driver.vehicleName}`}
      </p>

      <StatStrip
        stats={[
          { label: "Average rating", value: rating.average === null ? "—" : `★ ${rating.average.toFixed(1)}` },
          { label: "Ratings", value: rating.count },
          { label: "Open complaints", value: open },
        ]}
      />

      <Card title="Rating breakdown">
        {rating.count === 0 ? (
          <p className="text-muted">No ratings yet. Passengers can rate you once a trip is completed.</p>
        ) : (
          <RatingBars distribution={rating.distribution} count={rating.count} />
        )}
      </Card>

      <Card title="Latest reviews" aside={reviews.length > 0 && <span className="text-xs text-muted">Anonymous</span>}>
        {reviews.length === 0 ? (
          <p className="text-muted">No reviews yet.</p>
        ) : (
          <ReviewList reviews={reviews} />
        )}
      </Card>

      <Card title="Complaints about you">
        <p className="-mt-2 text-sm text-muted">
          Reported anonymously. An admin reviews each one and adds a note when it&apos;s decided.
        </p>
        {complaints.length === 0 ? (
          <p className="text-muted">No complaints.</p>
        ) : (
          <ul className="divide-y divide-border">
            {complaints.map((c) => (
              <li key={c.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{CATEGORY_LABELS[c.category]}</span>
                  <ComplaintStatusBadge status={c.status} />
                </div>
                <p>{c.description}</p>
                <p className="text-xs text-muted">Reported {formatDateTime(c.createdAt)}</p>
                {c.resolutionNote && (
                  <p className="border-l-2 border-border-strong pl-3 text-sm">
                    <span className="text-muted">Admin&apos;s note{c.resolvedAt && ` · ${formatDateTime(c.resolvedAt)}`}: </span>
                    {c.resolutionNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

// Newest first: stars, date, comment. Shared with the passenger's view of a driver.
export function ReviewList({ reviews }: { reviews: Profile["reviews"] }) {
  return (
    <ul className="divide-y divide-border">
      {reviews.map((r) => (
        <li key={r.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-4">
            <Stars value={r.stars} className="size-4" />
            <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
          </div>
          {r.comment ? <p>“{r.comment}”</p> : <p className="text-sm text-muted">No comment</p>}
        </li>
      ))}
    </ul>
  );
}

// 5 → 1, one bar per star value. Plain CSS widths: a chart library for five bars isn't worth it.
// The count is text, so the bar is decoration and hidden from screen readers.
export function RatingBars({ distribution, count }: { distribution: Profile["rating"]["distribution"]; count: number }) {
  return (
    <ul className="flex flex-col gap-2">
      {STAR_VALUES.map((stars) => {
        const n = distribution[stars];
        return (
          <li key={stars} className="grid grid-cols-[2.5rem_1fr_2rem] items-center gap-3 text-sm">
            <span className="font-mono tabular-nums">
              {stars} <span aria-hidden="true" className="text-star">★</span>
              <span className="sr-only">{stars === 1 ? "star" : "stars"}:</span>
            </span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-surface">
              <span className="block h-full rounded-full bg-star" style={{ width: `${(n / count) * 100}%` }} />
            </span>
            <span className="text-right font-mono tabular-nums">
              {n}
              <span className="sr-only"> {n === 1 ? "rating" : "ratings"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
