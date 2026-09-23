"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor, useSession } from "@/lib/session";

// "/" has no content of its own: signed-in users go to their dashboard, everyone else signs in.
export default function Home() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session !== undefined) router.replace(session ? homeFor(session.user.role) : "/login");
  }, [session, router]);

  return null;
}
