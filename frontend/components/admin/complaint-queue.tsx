"use client";

import { useState, type FormEvent } from "react";
import { CATEGORY_LABELS, ComplaintStatusBadge } from "@/components/ride/feedback-panel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/error-state";
import { Textarea } from "@/components/ui/field";
import { Toast } from "@/components/ui/toast";
import { useApi } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import type { AdminComplaint, ComplaintStatus } from "@/lib/types";
import { route } from "@/lib/zones";

const NOTE_MIN = 5;
const NOTE_MAX = 500;
const FILTERS: { label: string; status: ComplaintStatus | null }[] = [
  { label: "Open", status: "OPEN" },
  { label: "Resolved", status: "RESOLVED" },
  { label: "Dismissed", status: "DISMISSED" },
  { label: "All", status: null },
];

// Complaints → the queue, filtered by status. Open first: that's the admin's to-do list.
export function ComplaintQueue() {
  const [status, setStatus] = useState<ComplaintStatus | null>("OPEN");
  const { data, error, reload } = useApi<AdminComplaint[]>(
    `/admin/complaints${status ? `?status=${status}` : ""}`,
    10000,
  );
  const [toast, showToast] = useToast();

  return (
    <>
      <div role="group" aria-label="Show complaints" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f.label}
            size="sm"
            variant={status === f.status ? "primary" : "secondary"}
            aria-pressed={status === f.status}
            onClick={() => setStatus(f.status)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {!data ? (
        error ? (
          <ErrorState error={error} onRetry={reload} />
        ) : (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        )
      ) : data.length === 0 ? (
        <p className="text-muted">{status === "OPEN" ? "No open complaints. Nothing to review." : "Nothing here."}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {data.map((c) => (
            <li key={c.id}>
              <ComplaintCard
                complaint={c}
                onChange={(text) => {
                  if (text) showToast(text);
                  reload();
                }}
              />
            </li>
          ))}
        </ul>
      )}
      <Toast message={toast} />
    </>
  );
}

// One complaint, with everything the admin needs to decide it: who, about whom, which trip.
// onChange: reload the list; `toast` says what happened, when it worked.
export function ComplaintCard({
  complaint: c,
  onChange,
}: {
  complaint: AdminComplaint;
  onChange: (toast?: string) => void;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="font-semibold">
            {c.passengerName} <span aria-hidden="true">→</span>
            <span className="sr-only">reported</span> {c.driverName}
          </h3>
          <p className="text-xs text-muted">
            {CATEGORY_LABELS[c.category]} · {route(c.trip.pickupZone, c.trip.destinationZone)} · trip{" "}
            {formatDateTime(c.trip.date)}
          </p>
        </div>
        <ComplaintStatusBadge status={c.status} />
      </div>
      <p>{c.description}</p>
      <p className="text-xs text-muted">Reported {formatDateTime(c.createdAt)}</p>
      {c.status === "OPEN" ? (
        <DecideForm complaintId={c.id} onChange={onChange} />
      ) : (
        <p className="border-l-2 border-border-strong pl-3 text-sm">
          <span className="text-muted">
            {c.status === "RESOLVED" ? "Resolved" : "Dismissed"} by {c.resolvedBy}
            {c.resolvedAt && ` · ${formatDateTime(c.resolvedAt)}`}:{" "}
          </span>
          {c.resolutionNote}
        </p>
      )}
    </article>
  );
}

// A decision is final and always explained: the note goes to the passenger and the driver.
function DecideForm({ complaintId, onChange }: { complaintId: string; onChange: (toast?: string) => void }) {
  const [note, setNote] = useState("");
  const [sending, setSending] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const length = note.trim().length;

  async function decide(status: "RESOLVED" | "DISMISSED") {
    setSending(status);
    setError(null);
    try {
      await api.patch(`/admin/complaints/${complaintId}`, { status, resolutionNote: note.trim() });
      onChange(status === "RESOLVED" ? "Complaint resolved" : "Complaint dismissed");
    } catch (err) {
      setError(errorMessage(err, { INVALID_TRANSITION: "Someone already decided this complaint. Refreshing." }));
      setSending(null);
      onChange(); // e.g. another admin decided it: the refresh shows their decision
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    decide("RESOLVED");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 border-t border-border pt-3">
      <Textarea
        label="Note to the passenger and driver"
        hint={length < NOTE_MIN ? `Required, at least ${NOTE_MIN} characters` : `${length}/${NOTE_MAX}`}
        maxLength={NOTE_MAX}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" variant="secondary" disabled={length < NOTE_MIN || sending !== null}>
          {sending === "RESOLVED" ? "Resolving…" : "Resolve"}
        </Button>
        <Button variant="ghost" onClick={() => decide("DISMISSED")} disabled={length < NOTE_MIN || sending !== null}>
          {sending === "DISMISSED" ? "Dismissing…" : "Dismiss"}
        </Button>
      </div>
    </form>
  );
}
