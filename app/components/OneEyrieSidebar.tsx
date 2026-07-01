"use client";

import Link from "next/link";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import type { OneEyrieNavLabel } from "@/app/lib/role-permissions";

type OneEyrieSidebarProps = {
  active: OneEyrieNavLabel;
};

export default function OneEyrieSidebar({ active }: OneEyrieSidebarProps) {
  const { desktopNavItems, loading, permissions } = useRoleAccess();
  const navItems = !loading && permissions ? desktopNavItems : [];

  return (
    <aside className="one-eyrie-sidebar">
      <div className="one-eyrie-logo-block">
        <OneEyrieWordmark />
      </div>

      <nav aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = item.label === active;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={
                isActive
                  ? "one-eyrie-nav-item one-eyrie-nav-item--active"
                  : "one-eyrie-nav-item"
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export type { OneEyrieNavLabel };
