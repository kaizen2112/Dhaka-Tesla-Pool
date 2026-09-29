import type { Metadata } from "next";
import { ComplaintQueue } from "@/components/admin/complaint-queue";

export const metadata: Metadata = { title: "Complaints" };

export default function AdminComplaintsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Complaints</h1>
      <ComplaintQueue />
    </>
  );
}
