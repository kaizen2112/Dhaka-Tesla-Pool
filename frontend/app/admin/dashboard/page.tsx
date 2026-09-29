import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin/admin-overview";

export const metadata: Metadata = { title: "Overview" };

export default function AdminDashboardPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
      <AdminOverview />
    </>
  );
}
