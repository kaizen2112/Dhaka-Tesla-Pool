// "● ● ○  2 / 3 seats" — pips for a glance, the count in text for screen readers.
export function SeatsIndicator({ occupied, capacity }: { occupied: number; capacity: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: capacity }, (_, i) => (
          <span
            key={i}
            className={`size-2.5 rounded-full ${i < occupied ? "bg-foreground" : "border border-border-strong"}`}
          />
        ))}
      </div>
      <span className="font-mono tabular-nums">
        {occupied} / {capacity} seats
      </span>
    </div>
  );
}
