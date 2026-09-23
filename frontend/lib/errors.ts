import { ApiError } from "./api-client";

// One sentence per backend `error` code (docs/API_SPEC.md → Error shape). The raw `message`
// is never shown: it's written for developers and can change without notice.
const MESSAGES: Record<string, string> = {
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
  VALIDATION_ERROR: "Some details aren't valid. Check the form and try again.",
  UNAUTHORIZED: "Your session has ended. Sign in again.",
  FORBIDDEN: "You don't have access to this.",
  NOT_FOUND: "We couldn't find that.",
  EMAIL_TAKEN: "That email is already registered. Sign in instead.",
  VEHICLE_EXISTS: "You already have a Tesla.",
  VEHICLE_OFFLINE: "Go online before accepting rides.",
  ACTIVE_POOL_EXISTS: "Finish your current trip first.",
  ACTIVE_REQUEST_EXISTS: "You already have a ride in progress.",
  INVALID_TRANSITION: "This ride has changed. Refresh and try again.",
  CAPACITY_EXCEEDED: "Not enough free seats for this ride.",
  PAYMENT_NOT_ALLOWED: "You can pay once the trip is completed.",
  ALREADY_PAID: "This ride is already paid.",
  PICKUP_TOO_FAR: "This pickup is more than 2 km from the pool's pickup.",
  EXTRA_DISTANCE_TOO_HIGH: "Adding this passenger would take someone more than 2 km out of their way.",
  INSUFFICIENT_FUNDS: "Not enough TeslaPay balance. Pay with cash instead.",
};

// `overrides` lets a screen reword a code for its context, e.g. UNAUTHORIZED on the sign-in
// form means a wrong password, not an expired session.
export function errorMessage(error: unknown, overrides: Record<string, string> = {}) {
  const code = error instanceof ApiError ? error.code : "";
  return overrides[code] ?? MESSAGES[code] ?? "Something went wrong. Try again.";
}
