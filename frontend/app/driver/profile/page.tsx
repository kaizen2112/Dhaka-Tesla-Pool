import type { Metadata } from "next";
import { DriverProfile } from "@/components/ride/driver-profile";

export const metadata: Metadata = { title: "Profile" };

export default function DriverProfilePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
      <DriverProfile />
    </>
  );
}
