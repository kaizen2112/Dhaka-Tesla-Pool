"use client";

import { useEffect, useState } from "react";

const SHOW_MS = 5000;

// A toast you show yourself, e.g. "Complaint resolved" after an action. (useChangeToast is for
// changes noticed by polling.) Returns the message for <Toast> and a function to show one.
export function useToast() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  // A new id restarts the timer even when the same text comes twice.
  const show = (text: string) => setToast((t) => ({ id: (t?.id ?? 0) + 1, text }));
  return [toast?.text ?? null, show] as const;
}
