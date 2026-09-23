"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";

interface Result<T> {
  path: string;
  data?: T;
  error?: unknown;
}

// GET `path` (null = don't fetch yet), optionally re-fetching every `pollMs`. Polling keeps the
// last good data on screen, so a live view refreshes quietly instead of flashing a skeleton
// (docs/UI_GUIDE.md §8). No websockets: a 5 s poll is plenty for an MVP ride board.
export function useApi<T>(path: string | null, pollMs?: number) {
  const [result, setResult] = useState<Result<T>>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!path) return;
    let active = true;
    const load = () =>
      api.get<T>(path).then(
        (data) => active && setResult({ path, data }),
        // Keep the previous data for this path; only the error is new.
        (error) => active && setResult((prev) => ({ ...(prev?.path === path ? prev : { path }), error })),
      );
    load();
    const timer = pollMs ? setInterval(load, pollMs) : undefined;
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [path, pollMs, tick]);

  // Results from a previous path (e.g. the last ride's id) are never shown for the new one.
  const current = result?.path === path ? result : undefined;
  return {
    data: current?.data,
    error: current?.error,
    reload: useCallback(() => setTick((t) => t + 1), []),
  };
}
