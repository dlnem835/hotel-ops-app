"use client";

import type { ReactNode } from "react";

type AdminHeaderProps = {
  role?: string | null;
};

export default function AdminHeader({ role }: AdminHeaderProps) {
  return (
    <header className="admin-portal__header">
      <div>
        <h1 className="admin-portal__title">One Eyrie Admin</h1>
        <p className="admin-portal__subtitle">
          Internal operations console
          {role ? ` · ${role.replace("_", " ")}` : ""}
        </p>
      </div>
    </header>
  );
}
