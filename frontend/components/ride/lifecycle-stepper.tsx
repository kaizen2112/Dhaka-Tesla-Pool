import type { RideStatus } from "@/lib/types";

// The happy path of the state machine (docs/ARCHITECTURE.md §3), in the brief's words.
const STEPS: { status: RideStatus; label: string }[] = [
  { status: "REQUESTED", label: "Requested" },
  { status: "MATCHED", label: "Matched" },
  { status: "DRIVER_ARRIVED", label: "Driver arrived" },
  { status: "STARTED", label: "Started" },
  { status: "COMPLETED", label: "Completed" },
];

// Done steps filled, the current one ringed and bold, the rest hollow. CANCELLED has no place
// on the line, so the whole stepper is struck through and says so in words.
export function LifecycleStepper({ status }: { status: RideStatus }) {
  const cancelled = status === "CANCELLED";
  const current = STEPS.findIndex((s) => s.status === status);

  return (
    <div className="flex flex-col gap-2">
      <ol aria-label="Ride progress" className={`grid grid-cols-5 ${cancelled ? "opacity-50" : ""}`}>
        {STEPS.map((step, i) => {
          const done = !cancelled && i < current;
          const isCurrent = !cancelled && i === current;
          return (
            <li key={step.status} className="relative flex flex-col items-center gap-1.5 text-center">
              {/* Connector to the previous step: solid once that part of the ride is done. */}
              {i > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-[5px] right-1/2 h-px w-full ${i <= current && !cancelled ? "bg-foreground" : "bg-border-strong"}`}
                />
              )}
              <span
                aria-hidden
                className={`relative size-3 rounded-full ${
                  done
                    ? "bg-foreground"
                    : isCurrent
                      ? "bg-foreground ring-4 ring-border-strong"
                      : "border border-border-strong bg-background"
                }`}
              />
              <span
                className={`text-xs ${isCurrent ? "font-medium text-foreground" : done ? "text-foreground" : "text-muted"} ${cancelled ? "line-through" : ""}`}
              >
                {step.label}
                <span className="sr-only">{done ? " (done)" : isCurrent ? " (current)" : ""}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {cancelled && <p className="text-xs font-medium text-muted">Cancelled — this ride won&apos;t go ahead.</p>}
    </div>
  );
}
