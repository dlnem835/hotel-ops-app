"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import OneEyrieWordmark from "@/app/components/OneEyrieWordmark";
import OneEyriePropertySelector from "@/app/components/OneEyriePropertySelector";
import OneEyrieUserProfileMenu from "@/app/components/OneEyrieUserProfileMenu";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { DESKTOP_NAV_ICONS } from "@/app/lib/one-eyrie-desktop-nav-icons";
import type { OneEyrieNavLabel } from "@/app/lib/role-permissions";

const ADMIN_PORTAL_HREF = "/admin-portal";

type OneEyrieSidebarProps = {
  active: OneEyrieNavLabel | "Admin Portal";
};

export default function OneEyrieSidebar({ active }: OneEyrieSidebarProps) {
  const { desktopNavItems, loading, permissions, organizationAdministration } =
    useRoleAccess();
  const pathname = usePathname();
  const navItems = !loading && permissions ? desktopNavItems : [];
  const adminPortalActive =
    active === "Admin Portal" ||
    (pathname?.startsWith(ADMIN_PORTAL_HREF) ?? false);

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

        {organizationAdministration ? (
          <Link
            href={ADMIN_PORTAL_HREF}
            className={
              adminPortalActive
                ? "one-eyrie-nav-item one-eyrie-nav-item--active"
                : "one-eyrie-nav-item"
            }
          >
            <span className="one-eyrie-nav-item__inner">
              <ShieldCheck
                className="one-eyrie-nav-item__icon"
                strokeWidth={1.75}
                aria-hidden
              />
              <span className="one-eyrie-nav-item__label">Admin Portal</span>
            </span>
          </Link>
        ) : null}
      </nav>

      <div className="one-eyrie-sidebar__profile">
        <OneEyrieUserProfileMenu variant="sidebar" />
      </div>
    </aside>
  );
}

export type { OneEyrieNavLabel };
