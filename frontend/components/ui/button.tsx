import type { ButtonHTMLAttributes } from "react";

// docs/UI_GUIDE.md §5. At most one primary button per screen; Danger is outlined, never filled.
const VARIANTS = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "border border-border bg-background hover:bg-surface",
  ghost: "hover:bg-surface",
  danger: "border border-border text-danger hover:bg-surface",
};

const SIZES = {
  md: "h-10 px-4",
  sm: "h-8 px-3 text-xs",
};

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

// Exported so a <Link> can look like a button (e.g. an empty state's next action).
export function buttonClasses(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
