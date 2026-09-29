import type { Metadata } from "next";
import { UserTable } from "@/components/admin/user-table";

export const metadata: Metadata = { title: "Users" };

export default function AdminUsersPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
      <UserTable />
    </>
  );
}
