import { useMemo, useSyncExternalStore } from "react";
import type { AuthResponse, Role } from "./types";

// The JWT lives in localStorage: simple, and every request sends it as a Bearer header, so
// there's no CSRF surface. Trade-off: any script that runs on the page (XSS) can read it.
// An httpOnly cookie would hide it from scripts, at the cost of CSRF protection and a
// same-site API — see the README.
const KEY = "tesla-pool-session";
// localStorage fires "storage" only in *other* tabs, so this tab announces its own changes.
const CHANGED = "tesla-pool-session-changed";

export type Session = AuthResponse;

export function homeFor(role: Role) {
  return role === "DRIVER" ? "/driver/dashboard" : "/passenger/dashboard";
}

export function getToken(): string | null {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Session).accessToken : null;
}

export function saveSession(session: Session) {
  localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(CHANGED));
}

export function clearSession() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}

// undefined = not known yet (server render / hydration), null = signed out.
// Pages must wait for undefined to resolve before redirecting, or a signed-in user would be
// bounced to /login on every first paint.
export function useSession(): Session | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(KEY),
    () => undefined,
  );
  return useMemo(
    () => (raw === undefined ? undefined : raw ? (JSON.parse(raw) as Session) : null),
    [raw],
  );
}
