import type { Metadata } from "next";
import { RideRequestForm } from "@/components/forms/ride-request-form";

export const metadata: Metadata = { title: "Request a ride" };

export default function RequestRidePage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Request a ride</h1>
        <p className="text-muted">
          You&apos;ll join a Tesla already heading your way if one fits, or wait for a driver.
        </p>
      </div>
      <RideRequestForm />
    </>
  );
}
