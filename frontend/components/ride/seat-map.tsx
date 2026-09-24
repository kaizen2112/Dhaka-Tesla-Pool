export interface Seat {
  initial: string; // shown in the box
  name: string; // tooltip
  emphasis?: boolean; // filled (you, or every rider on the driver's view); otherwise outlined
}

// One box per seat of the Tesla: taken seats carry the rider's initial, free ones are dashed.
// The count is also written out, so it reads without the picture (docs/UI_GUIDE.md §7).
export function SeatMap({ capacity, seats }: { capacity: number; seats: Seat[] }) {
  const free = capacity - seats.length;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: capacity }, (_, i) => {
          const seat = seats[i];
          if (!seat) {
            return <span key={i} className="size-8 rounded-lg border border-dashed border-border-strong" />;
          }
          return (
            <span
              key={i}
              title={seat.name}
              className={`flex size-8 items-center justify-center rounded-lg text-xs font-medium ${
                seat.emphasis ? "bg-foreground text-background" : "border border-foreground"
              }`}
            >
              {seat.initial}
            </span>
          );
        })}
      </div>
      <span className="font-mono text-xs tabular-nums text-muted">
        {seats.length} / {capacity} taken · {free} free
      </span>
    </div>
  );
}

export const initialOf = (name: string) => name.trim().charAt(0).toUpperCase();
