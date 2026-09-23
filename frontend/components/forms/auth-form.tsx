"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/errors";
import { homeFor, saveSession, useSession } from "@/lib/session";
import type { AuthResponse } from "@/lib/types";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const session = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isLogin = mode === "login";

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
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted">Dhaka Tesla Pool</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isLogin ? "Sign in" : "Create an account"}
        </h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {!isLogin && <Input label="Name" name="name" autoComplete="name" required />}
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input
          label="Password"
          name="password"
          type="password"
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

      <div className="flex flex-col gap-2 text-sm text-muted">
        {isLogin ? (
          <>
            <p>
              No account?{" "}
              <Link href="/register" className="font-medium text-foreground underline underline-offset-4">
                Create one
              </Link>
            </p>
            <p className="text-xs">
              Demo: <span className="font-mono">nusrat@teslapool.dev</span> (passenger) or{" "}
              <span className="font-mono">jashim@teslapool.dev</span> (driver), password{" "}
              <span className="font-mono">password123</span>.
            </p>
          </>
        ) : (
          <p>
            Already registered?{" "}
            <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
