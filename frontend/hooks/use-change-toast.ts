"use client";

import { useEffect, useState } from "react";

const SHOW_MS = 5000;

// Watches a polled snapshot and returns a short message when it changes, e.g. "Rafiq joined
// your pool". Never on first load: the first snapshot is only remembered.
// The comparison happens during render (React's "adjust state when data changes" pattern), so
// there's no extra effect pass and no stale flash.
export function useChangeToast<T>(snapshot: T | undefined, describe: (before: T, after: T) => string | null) {
  const key = snapshot === undefined ? undefined : JSON.stringify(snapshot);
  const [seen, setSeen] = useState<{ key?: string; snapshot?: T }>({});
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  if (key !== undefined && key !== seen.key) {
    setSeen({ key, snapshot });
    const text = seen.snapshot === undefined ? null : describe(seen.snapshot, snapshot as T);
    // A new id restarts the timer even when the same text comes twice.
    if (text) setToast({ id: (toast?.id ?? 0) + 1, text });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return toast?.text ?? null;
}
