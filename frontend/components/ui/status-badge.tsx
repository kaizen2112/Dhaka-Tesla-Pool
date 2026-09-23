import type { RideStatus } from "@/lib/types";

// Passenger-facing words from docs/ARCHITECTURE.md §3. The style carries the meaning without
// colour (docs/UI_GUIDE.md §7), so the badge still reads in greyscale and to screen readers.
const BADGES: Record<RideStatus, { label: string; style: string }> = {
  REQUESTED: { label: "Waiting", style: "border border-dashed border-border-strong text-muted" },
  MATCHED: { label: "Matched", style: "border border-foreground text-foreground" },
  DRIVER_ARRIVED: { label: "Driver arrived", style: "border border-foreground text-foreground" },
  STARTED: { label: "In progress", style: "bg-primary text-primary-foreground" },
  COMPLETED: { label: "Completed", style: "bg-surface text-foreground" },
  CANCELLED: { label: "Cancelled", style: "bg-surface text-muted line-through" },
};

export function StatusBadge({ status }: { status: RideStatus }) {
  const { label, style } = BADGES[status];
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
