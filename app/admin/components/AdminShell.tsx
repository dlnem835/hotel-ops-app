"use client";

import type { ReactNode } from "react";
import AdminHeader from "./AdminHeader";
import AdminNav from "./AdminNav";

type AdminShellProps = {
  children: ReactNode;
  role?: string | null;
};

export default function AdminShell({ children, role }: AdminShellProps) {
  return (
    <div className="admin-portal">
      <AdminHeader role={role} />
      <AdminNav />
      <main className="admin-portal__main">{children}</main>
    </div>
  );
}
