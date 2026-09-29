import type { ReactNode } from "react";

// One stroked 24px path per section icon, like the nav icons (docs/UI_GUIDE.md §7).
const ICONS = {
  star: "M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z",
  flag: "M5 21V4M5 4h12l-2.5 4 2.5 4H5",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0zM12 7v5l3 2",
  wallet: "M3 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 7l12-3v3M16 13h.01",
};

// The icon square's tint says what kind of section it is: ratings (star), problems (danger),
// everything else neutral.
const TONES = {
  star: "bg-star/15 text-star",
  danger: "bg-danger/10 text-danger",
  neutral: "bg-surface text-muted",
};

const CHEVRON = "M6 9l6 6 6-6";

function Icon({ d, className }: { d: string; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function Header({ icon, tone, title, aside }: { icon: keyof typeof ICONS; tone: keyof typeof TONES; title: ReactNode; aside?: ReactNode }) {
  return (
    <>
      <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${TONES[tone]}`}>
        <Icon d={ICONS[icon]} className="size-4" />
      </span>
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {aside}
    </>
  );
}

// A titled part of a card (payment, rating, report, timeline): divider above, icon + title,
// then the content. Not a nested card: no border box, so the page stays calm.
// `collapsible` makes the whole header row a native <details> toggle, closed by default.
export function Section({
  icon,
  tone = "neutral",
  title,
  aside,
  collapsible,
  children,
}: {
  icon: keyof typeof ICONS;
  tone?: keyof typeof TONES;
  title: ReactNode;
  aside?: ReactNode;
  collapsible?: boolean;
  children: ReactNode;
}) {
  if (collapsible) {
    return (
      <details className="group border-t border-border pt-5">
        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-foreground [&::-webkit-details-marker]:hidden">
          <Header icon={icon} tone={tone} title={title} aside={aside} />
          <Icon d={CHEVRON} className="ml-auto size-4 text-muted transition-transform group-open:rotate-180" />
        </summary>
        <div className="flex flex-col gap-3 pt-4">{children}</div>
      </details>
    );
  }
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5">
      <div className="flex flex-wrap items-center gap-3">
        <Header icon={icon} tone={tone} title={title} aside={aside} />
      </div>
      {children}
    </section>
  );
}
