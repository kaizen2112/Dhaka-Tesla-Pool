"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger"; // danger: cancelling a ride, anything you'd regret
}

// The app's own "Are you sure?", instead of the browser's confirm() box.
// Usage: const [dialog, confirm] = useConfirm(); … if (!(await confirm({ … }))) return; … {dialog}
export function useConfirm() {
  const [open, setOpen] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = (options: ConfirmOptions) =>
    new Promise<boolean>((resolve) => setOpen({ ...options, resolve }));

  const dialog = open && (
    <ConfirmDialog
      {...open}
      onClose={(ok) => {
        open.resolve(ok);
        setOpen(null);
      }}
    />
  );
  return [dialog, confirm] as const;
}

// Native <dialog> + showModal(): the browser traps focus inside, makes the page behind inert,
// and closes on Esc (the `cancel` event). Focus starts on the safe choice, Cancel.
function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  onClose,
}: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    // Development runs effects twice, and showModal() on an open dialog throws.
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault(); // we close it ourselves, so React state stays the source of truth
        onClose(false);
      }}
      // A click on the dialog element itself (not its content) is a click on the backdrop.
      onClick={(e) => e.target === e.currentTarget && onClose(false)}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-xl border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
    >
      <div className="flex flex-col gap-4 p-5">
        <h2 id={titleId} className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="text-sm text-muted">{message}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" autoFocus onClick={() => onClose(false)}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={() => onClose(true)}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
