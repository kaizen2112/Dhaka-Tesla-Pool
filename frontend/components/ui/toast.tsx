// A live region that's always in the page, so screen readers announce the message the moment
// it appears (docs/UI_GUIDE.md §7). Sits above the mobile tab bar; a floating overlay, so it's
// the one place a shadow is allowed.
export function Toast({ message }: { message: string | null }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-24 z-20 flex justify-center px-4 md:bottom-6"
    >
      {message && (
        <p className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm">
          {message}
        </p>
      )}
    </div>
  );
}
