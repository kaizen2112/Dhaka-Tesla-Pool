"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import type { ComplaintCategory, ComplaintStatus, DriverRating, MembershipFeedback } from "@/lib/types";

// Shared with the driver profile and the admin pages.
export const CATEGORY_LABELS: Record<ComplaintCategory, string> = {
  DANGEROUS_DRIVING: "Dangerous driving",
  RUDE_BEHAVIOUR: "Rude behaviour",
  VEHICLE_CONDITION: "Vehicle condition",
  ROUTE_OR_FARE: "Route or fare",
  SAFETY: "Safety",
  OTHER: "Other",
};

const STAR_WORDS = ["Bad", "Poor", "Okay", "Good", "Great"];
const STAR_PATH = "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z";
const COMMENT_MAX = 500;
const DESCRIPTION_MIN = 10;
const DESCRIPTION_MAX = 1000;

function StarIcon({ filled, className = "size-5" }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" strokeWidth="1.5" strokeLinejoin="round">
      <path d={STAR_PATH} className={filled ? "fill-foreground stroke-foreground" : "fill-none stroke-border-strong"} />
    </svg>
  );
}

// Read-only stars, e.g. the rating you gave. Monochrome (docs/UI_GUIDE.md §7): filled vs outlined.
export function Stars({ value, className }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span role="img" aria-label={`${value} out of 5 stars`} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} filled={n <= filled} className={className} />
      ))}
    </span>
  );
}

// "★ 4.5 (2)" beside a driver's name; "New driver" before anyone has rated them.
export function DriverRatingText({ rating }: { rating: DriverRating }) {
  if (rating.average === null) return <span className="text-muted">New driver</span>;
  return (
    <span aria-label={`rated ${rating.average} out of 5 from ${rating.count} ${rating.count === 1 ? "rating" : "ratings"}`}>
      <span aria-hidden="true">
        ★ <span className="font-mono tabular-nums">{rating.average.toFixed(1)}</span>{" "}
        <span className="text-muted">({rating.count})</span>
      </span>
    </span>
  );
}

// Style carries the meaning without colour, like StatusBadge.
const COMPLAINT_BADGES: Record<ComplaintStatus, { label: string; style: string }> = {
  OPEN: { label: "Under review", style: "border border-dashed border-border-strong text-muted" },
  RESOLVED: { label: "Resolved", style: "border border-foreground text-foreground" },
  DISMISSED: { label: "Dismissed", style: "bg-surface text-muted" },
};

export function ComplaintStatusBadge({ status }: { status: ComplaintStatus }) {
  const { label, style } = COMPLAINT_BADGES[status];
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium ${style}`}>{label}</span>
  );
}

// What changed in a booking's feedback between two polls, as a toast.
export interface FeedbackSnapshot {
  rated: boolean;
  complaint: ComplaintStatus | null;
}

export function feedbackSnapshot(feedback: MembershipFeedback | null | undefined): FeedbackSnapshot {
  return { rated: Boolean(feedback?.rating), complaint: feedback?.complaint?.status ?? null };
}

export function feedbackChange(before: FeedbackSnapshot, after: FeedbackSnapshot, driver = "your driver") {
  if (!before.rated && after.rated) return `Thanks for rating ${driver}`;
  if (!before.complaint && after.complaint) return "Report sent. An admin will review it";
  if (before.complaint === "OPEN" && after.complaint === "RESOLVED") return "Your report was resolved";
  if (before.complaint === "OPEN" && after.complaint === "DISMISSED") return "Your report was reviewed and closed";
  return null;
}

// Rate the driver and/or report a problem, for one completed booking (docs/API_SPEC.md →
// Feedback). The API is what enforces "completed, yours, once"; this just shows the right state.
export function FeedbackPanel({
  membershipId,
  driverName,
  feedback,
  onChange,
}: {
  membershipId: string;
  driverName?: string;
  feedback: MembershipFeedback;
  onChange: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      {feedback.rating ? (
        <div className="flex flex-col gap-1">
          <p className="font-medium">You rated {driverName ?? "your driver"}</p>
          <Stars value={feedback.rating.stars} className="size-4" />
          {feedback.rating.comment && <p className="text-sm text-muted">“{feedback.rating.comment}”</p>}
        </div>
      ) : (
        <RatingForm membershipId={membershipId} driverName={driverName} onDone={onChange} />
      )}

      {feedback.complaint ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Your report · {CATEGORY_LABELS[feedback.complaint.category]}</p>
            <ComplaintStatusBadge status={feedback.complaint.status} />
          </div>
          <p className="text-sm text-muted">
            {feedback.complaint.resolutionNote
              ? `Admin's note: ${feedback.complaint.resolutionNote}`
              : "An admin will review it. The driver never sees your name."}
          </p>
        </div>
      ) : (
        <details>
          <summary className="w-fit cursor-pointer rounded text-sm text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground">
            Report a problem
          </summary>
          <ComplaintForm membershipId={membershipId} onDone={onChange} />
        </details>
      )}
    </div>
  );
}

function RatingForm({
  membershipId,
  driverName,
  onDone,
}: {
  membershipId: string;
  driverName?: string;
  onDone: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = hovered || stars;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post(`/ratings/${membershipId}`, { stars, comment: comment.trim() || undefined });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
      // Also after ALREADY_RATED (another tab): the refresh shows the stored rating.
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {/* Native radios: arrow keys move between stars and screen readers read "4 stars, Good". */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">How was your ride with {driverName ?? "your driver"}?</legend>
        <div className="flex items-center gap-3">
          <div className="flex" onMouseLeave={() => setHovered(0)}>
            {[1, 2, 3, 4, 5].map((n) => (
              <label
                key={n}
                onMouseEnter={() => setHovered(n)}
                className="cursor-pointer rounded p-1 has-focus-visible:outline-2 has-focus-visible:outline-foreground"
              >
                <input
                  type="radio"
                  name={`stars-${membershipId}`}
                  value={n}
                  checked={stars === n}
                  onChange={() => setStars(n)}
                  className="sr-only"
                />
                <StarIcon filled={n <= shown} className="size-7" />
                <span className="sr-only">
                  {n} {n === 1 ? "star" : "stars"}, {STAR_WORDS[n - 1]}
                </span>
              </label>
            ))}
          </div>
          <span className="text-sm text-muted" aria-hidden="true">
            {shown ? STAR_WORDS[shown - 1] : "Tap a star"}
          </span>
        </div>
      </fieldset>
      {stars > 0 && (
        <Textarea
          label="Comment (optional)"
          hint={`${comment.length}/${COMMENT_MAX}`}
          maxLength={COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={!stars || sending} className="self-start">
        {sending ? "Sending…" : "Submit rating"}
      </Button>
    </form>
  );
}

function ComplaintForm({ membershipId, onDone }: { membershipId: string; onDone: () => void }) {
  const [category, setCategory] = useState<ComplaintCategory>("DANGEROUS_DRIVING");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const length = description.trim().length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      await api.post(`/complaints/${membershipId}`, { category, description: description.trim() });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
      onDone();
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-3">
      <p className="text-sm text-muted">Only the admin sees who sent a report. The driver sees what happened, not who said it.</p>
      <Select label="What happened?" value={category} onChange={(e) => setCategory(e.target.value as ComplaintCategory)}>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </Select>
      <Textarea
        label="Details"
        hint={length < DESCRIPTION_MIN ? `At least ${DESCRIPTION_MIN} characters` : `${length}/${DESCRIPTION_MAX}`}
        maxLength={DESCRIPTION_MAX}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" variant="danger" disabled={length < DESCRIPTION_MIN || sending} className="self-start">
        {sending ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}
