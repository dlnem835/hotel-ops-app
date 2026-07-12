"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true },
  { href: "/admin/organizations", label: "Organizations", exact: false },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-portal__nav" aria-label="Admin navigation">
      {NAV_ITEMS.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active ? "admin-portal__nav-link admin-portal__nav-link--active" : "admin-portal__nav-link"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
