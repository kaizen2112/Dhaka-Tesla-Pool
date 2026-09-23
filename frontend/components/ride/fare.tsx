import { formatTaka } from "@/lib/format";

// Always says which fare it is: the estimate can still change until the trip is COMPLETED
// (docs/ARCHITECTURE.md §7).
export function Fare({ poysha, final }: { poysha: number; final: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted">{final ? "Final fare" : "Estimated fare"}</span>
      <span className="font-mono text-3xl font-semibold tabular-nums">{formatTaka(poysha)}</span>
    </div>
  );
}
