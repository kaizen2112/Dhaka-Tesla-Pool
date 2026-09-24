"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, PasswordInput, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { homeFor, saveSession, useSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

// The seeded cast (backend/prisma/seed.ts). Public demo logins, not secrets.
const DEMO_PASSWORD = "password123";
const DEMO_ACCOUNTS = [
  { name: "Jashim", role: "Driver · Bullet", email: "jashim@teslapool.dev" },
  { name: "Nusrat", role: "Passenger", email: "nusrat@teslapool.dev" },
  { name: "Rafiq", role: "Passenger", email: "rafiq@teslapool.dev" },
  { name: "Shirin", role: "Passenger", email: "shirin@teslapool.dev" },
];

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const session = useSession();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";

  // The inputs are uncontrolled, so filling them is just setting their DOM values.
  function fillDemo(email: string) {
    const fields = formRef.current?.elements;
    if (!fields) return;
    (fields.namedItem("email") as HTMLInputElement).value = email;
    (fields.namedItem("password") as HTMLInputElement).value = DEMO_PASSWORD;
    setError(null);
    formRef.current?.querySelector<HTMLButtonElement>("button[type=submit]")?.focus();
  }

  // Covers both "already signed in" and "just signed in": saving the session changes it,
  // and this sends the user to their role's dashboard.
  useEffect(() => {
    if (session) router.replace(homeFor(session.user.role));
  }, [session, router]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    // Uncontrolled inputs: on error the user's input stays in the fields.
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      saveSession(await api.post<AuthResponse>(`/auth/${mode}`, body));
    } catch (err) {
      setError(errorMessage(err, { UNAUTHORIZED: "Wrong email or password." }));
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-4 py-12">
      <div className="flex flex-col gap-6 rounded-xl border border-border bg-surface p-6 sm:p-8">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">Dhaka Tesla Pool</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isLogin ? "Sign in" : "Create an account"}
          </h1>
        </div>

        <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-4">
          {!isLogin && <Input label="Name" name="name" autoComplete="name" required />}
          <Input label="Email" name="email" type="email" autoComplete="email" required />
          <PasswordInput
            label="Password"
            name="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 8}
            maxLength={72}
            hint={isLogin ? undefined : "8–72 characters."}
            required
          />
          {!isLogin && (
            <Select label="I am a" name="role" defaultValue="PASSENGER">
              <option value="PASSENGER">Passenger</option>
              <option value="DRIVER">Driver</option>
            </Select>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={pending} className="w-full">
            {isLogin ? (pending ? "Signing in…" : "Sign in") : pending ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-muted">
          {isLogin ? "No account? " : "Already registered? "}
          <Link
            href={isLogin ? "/register" : "/login"}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {isLogin ? "Create one" : "Sign in"}
          </Link>
        </p>
      </div>

      {isLogin && (
        <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">Demo accounts</h2>
            <span className="text-xs text-muted">
              Tap to fill · <span className="font-mono">{DEMO_PASSWORD}</span>
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {DEMO_ACCOUNTS.map((a) => (
              <li key={a.email}>
                <button
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className="flex w-full flex-col items-start gap-0.5 rounded-lg border border-border px-3 py-2 text-left transition-colors hover:border-border-strong hover:bg-surface focus-visible:outline-2 focus-visible:outline-foreground"
                >
                  <span className="flex w-full items-baseline justify-between gap-2">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-xs text-muted">{a.role}</span>
                  </span>
                  <span className="font-mono text-xs text-muted">{a.email}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
