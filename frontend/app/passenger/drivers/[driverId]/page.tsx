import type { Metadata } from "next";
import Link from "next/link";
import { DriverPublicProfile } from "@/components/ride/driver-public-profile";

export const metadata: Metadata = { title: "Driver" };

export default async function DriverProfilePage({ params }: { params: Promise<{ driverId: string }> }) {
  const { driverId } = await params;
  return (
    <>
      <Link href="/passenger/dashboard" className="-mb-4 self-start text-xs text-muted hover:text-foreground">
        ← Your ride
      </Link>
      <DriverPublicProfile driverId={driverId} />
    </>
  );
}
