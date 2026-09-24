import type { ReactNode } from "react";

// Full class names so Tailwind generates them. Four stats go 2×2 on phones; the grid is always
// full, so the 1px dividers (the border colour showing through gap-px) never leave a hole.
const COLUMNS: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-2 sm:grid-cols-4",
};

// A row of headline numbers above a list (docs/UI_GUIDE.md §9): label small, value big and mono.
export function StatStrip({ stats }: { stats: { label: string; value: ReactNode }[] }) {
  return (
    <dl
      className={`grid gap-px overflow-hidden rounded-xl border border-border bg-border ${COLUMNS[stats.length] ?? "grid-cols-2"}`}
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
