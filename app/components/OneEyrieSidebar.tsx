"use client";

import Link from "next/link";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Lost & Found", href: "/" },
  { label: "Pass-On Log", href: "/pass-on-log" },
  { label: "Inspections", href: "/inspections" },
  { label: "Maintenance", href: "/maintenance" },
  { label: "Settings", href: "/settings" },
] as const;

export type OneEyrieNavLabel = (typeof NAV_ITEMS)[number]["label"];

type OneEyrieSidebarProps = {
  active: OneEyrieNavLabel;
};

export default function OneEyrieSidebar({ active }: OneEyrieSidebarProps) {
  return (
    <aside className="one-eyrie-sidebar">
      <div className="one-eyrie-logo-block">
        <div className="one-eyrie-logo-title">ONE</div>
        <div className="one-eyrie-logo-subtitle">— EYRIE —</div>
      </div>

      <nav aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
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
