import type { ReactNode } from "react";

// docs/UI_GUIDE.md §7. Don't nest cards.
export function Card({
  title,
  aside,
  children,
}: {
  title?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border p-5">
      {(title || aside) && (
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

// Loading placeholder shaped like the content it replaces (docs/UI_GUIDE.md §8).
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`rounded-xl bg-surface motion-safe:animate-pulse ${className}`} />;
}
