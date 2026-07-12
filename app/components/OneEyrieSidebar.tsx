"use client";

import Link from "next/link";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import OneEyriePropertySelector from "@/app/components/OneEyriePropertySelector";
import OneEyrieUserProfileMenu from "@/app/components/OneEyrieUserProfileMenu";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { DESKTOP_NAV_ICONS } from "@/app/lib/one-eyrie-desktop-nav-icons";
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

      <OneEyriePropertySelector />

      <nav className="one-eyrie-sidebar__nav" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = item.label === active;
          const NavIcon = DESKTOP_NAV_ICONS[item.label as OneEyrieNavLabel];
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
              <span className="one-eyrie-nav-item__inner">
                <NavIcon
                  className="one-eyrie-nav-item__icon"
                  strokeWidth={1.75}
                  aria-hidden
                />
                <span className="one-eyrie-nav-item__label">{item.label}</span>
              </span>
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
