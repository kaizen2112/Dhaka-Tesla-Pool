"use client";

import Link from "next/link";
import { RatingBars, ReviewList } from "@/components/ride/driver-profile";
import { DriverRatingText } from "@/components/ride/feedback-panel";
import { initialOf } from "@/components/ride/seat-map";
import { Card, Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { StatStrip } from "@/components/ui/stat-strip";
import { useApi } from "@/hooks/use-api";
import type { DriverRating, PublicDriverProfile } from "@/lib/types";

const CHEVRON_RIGHT = "M9 18l6-6-6-6";

function Avatar({ name, size }: { name: string; size: "md" | "lg" }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground ${size === "lg" ? "size-16 text-2xl" : "size-12 text-lg"}`}
    >
      {initialOf(name)}
    </span>
  );
}

// "Your driver" on the passenger's ride: who's coming, in which Tesla, how they're rated.
// The whole card is one link to their profile, a big tap target on a phone.
export function DriverCard({
  driverId,
  name,
  vehicleName,
  rating,
}: {
  driverId: string;
  name: string;
  vehicleName: string;
  rating: DriverRating;
}) {
  return (
    <Link
      href={`/passenger/drivers/${driverId}`}
      className="group flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-foreground"
    >
      <Avatar name={name} size="md" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs text-muted">Your driver</span>
        <span className="text-base font-semibold">{name}</span>
        <span className="text-sm text-muted">
          {vehicleName} · <DriverRatingText rating={rating} />
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1 text-sm text-muted group-hover:text-foreground">
        <span className="hidden sm:inline">View profile</span>
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d={CHEVRON_RIGHT} />
        </svg>
      </span>
    </Link>
  );
}

const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { month: "short", year: "numeric" });

// A driver as passengers see them (docs/API_SPEC.md → GET /drivers/:id/profile): rating,
// breakdown and reviews. No complaints and no reviewer names, because the API never sends them.
export function DriverPublicProfile({ driverId }: { driverId: string }) {
  const { data, error, reload } = useApi<PublicDriverProfile>(`/drivers/${driverId}/profile`);

  if (!data) {
    if (error) return <ErrorState error={error} onRetry={reload} />;
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const { driver, rating, reviews } = data;
  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={driver.name} size="lg" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{driver.name}</h1>
          <p className="text-sm text-muted">
            {driver.vehicleName
              ? `${driver.vehicleName} · ${driver.vehicleCapacity} seats`
              : "No Tesla yet"}{" "}
            · Driving since {monthYear(driver.memberSince)}
          </p>
        </div>
      </div>

      <StatStrip
        stats={[
          { label: "Rating", value: rating.average === null ? "New" : `★ ${rating.average.toFixed(1)}` },
          { label: "Ratings", value: rating.count },
          { label: "Trips completed", value: driver.tripsCompleted },
        ]}
      />

      <Card title="Rating breakdown">
        {rating.count === 0 ? (
          <p className="text-muted">No ratings yet. {driver.name} is new to Dhaka Tesla Pool.</p>
        ) : (
          <RatingBars distribution={rating.distribution} count={rating.count} />
        )}
      </Card>

      <Card
        title="What passengers say"
        aside={reviews.length > 0 && <span className="text-xs text-muted">Anonymous</span>}
      >
        {reviews.length === 0 ? <p className="text-muted">No reviews yet.</p> : <ReviewList reviews={reviews} />}
      </Card>

    </>
  );
}
