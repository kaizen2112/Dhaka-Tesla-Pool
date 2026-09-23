import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";

// docs/UI_GUIDE.md §6: label above, hint or error below, linked with aria-describedby.
// text-base on mobile stops iOS zooming into the field on focus.
const CONTROL =
  "h-10 w-full rounded-md border border-border bg-background px-3 text-base sm:text-sm hover:border-border-strong focus-visible:outline-2 focus-visible:outline-foreground";

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-note`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-note`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  label,
  hint,
  error,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <input
        id={id}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...props}
      />
    </Field>
  );
}

// Native <select> on purpose (zones, roles): accessible and mobile-friendly for free.
export function Select({
  label,
  hint,
  error,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Field id={id} label={label} hint={hint} error={error}>
      <select
        id={id}
        className={CONTROL}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...props}
      >
        {children}
      </select>
    </Field>
  );
}
