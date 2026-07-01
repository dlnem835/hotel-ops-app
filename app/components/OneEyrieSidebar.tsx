"use client";

import Link from "next/link";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import OneEyrieUserProfileMenu from "@/app/components/OneEyrieUserProfileMenu";
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
        <OneEyrieWordmark className="one-eyrie-wordmark--sidebar" />
      </div>

      <nav className="one-eyrie-sidebar__nav" aria-label="Main navigation">
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

      <div className="one-eyrie-sidebar__profile">
        <OneEyrieUserProfileMenu variant="sidebar" />
      </div>
    </aside>
  );
}

export type { OneEyrieNavLabel };
