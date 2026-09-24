import type { ReactNode } from "react";

// A row of headline numbers above a list (docs/UI_GUIDE.md §7): label small, value big and mono.
// One row at every width (2–3 stats fit at 375px), so the 1px dividers never leave a gap.
export function StatStrip({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl
      className="grid gap-px overflow-hidden rounded-xl border border-border bg-border"
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
    >
      {stats.map(({ label, value }) => (
        <div key={label} className="flex flex-col gap-1 bg-background p-3 sm:p-4">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="truncate font-mono text-lg font-semibold tabular-nums sm:text-xl">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
