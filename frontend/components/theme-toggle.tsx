"use client";

import { useSyncExternalStore } from "react";

const KEY = "tesla-pool-theme"; // read by the before-paint script in app/layout.tsx
const CHANGED = "tesla-pool-theme-changed";

type Theme = "light" | "dark";

// The theme lives on <html data-theme>, not in React state, so every toggle on the page agrees.
function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGED, onChange);
  return () => window.removeEventListener(CHANGED, onChange);
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // Storage blocked: the switch still works for this visit.
  }
  window.dispatchEvent(new Event(CHANGED));
}

const SUN =
  "M12 3v1.5M12 19.5V21M4.2 4.2l1.1 1.1M18.7 18.7l1.1 1.1M3 12h1.5M19.5 12H21M4.2 19.8l1.1-1.1M18.7 5.3l1.1-1.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z";
const MOON = "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z";

export function ThemeToggle() {
  // null on the server: the theme is only known in the browser, so render a same-size
  // placeholder until then (no hydration mismatch, no layout shift).
  const theme = useSyncExternalStore(subscribe, current, () => null);
  if (!theme) return <span className="size-9" aria-hidden />;

  const next = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex size-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-2 focus-visible:outline-foreground"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {/* Shows what you'll switch to. */}
        <path d={theme === "dark" ? SUN : MOON} />
      </svg>
    </button>
  );
}
