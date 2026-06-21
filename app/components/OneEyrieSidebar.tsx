"use client";

import Link from "next/link";

const gold = "#C8A96A";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/" },
  { label: "Lost & Found", href: "/" },
  { label: "Pass-On Log", href: "/pass-on-log" },
  { label: "Inspections", href: "/inspections" },
  { label: "Maintenance", href: "#" },
  { label: "Settings", href: "/settings" },
] as const;

type OneEyrieSidebarProps = {
  active: (typeof NAV_ITEMS)[number]["label"];
};

export default function OneEyrieSidebar({ active }: OneEyrieSidebarProps) {
  return (
    <aside
      className="one-eyrie-sidebar"
      style={{
        width: "245px",
        borderRight: "1px solid #2A2A2A",
        background: "#211F1B",
        padding: "28px 18px",
        flexShrink: 0,
      }}
    >
      <div style={{ marginBottom: "42px" }}>
        <div style={{ color: gold, fontSize: "28px", fontWeight: "bold" }}>ONE</div>
        <div style={{ color: gold, letterSpacing: "4px", fontSize: "13px" }}>
          — EYRIE —
        </div>
      </div>

      {NAV_ITEMS.map((item) => {
        const isActive = item.label === active;
        return (
          <div
            key={item.label}
            style={{
              padding: "14px 16px",
              borderRadius: "10px",
              marginBottom: "8px",
              background: isActive ? gold : "transparent",
              color: isActive ? "#111" : "#fff",
              fontWeight: isActive ? "bold" : "normal",
            }}
          >
            <Link
              href={item.href}
              style={{
                color: "inherit",
                textDecoration: "none",
                display: "block",
                width: "100%",
              }}
            >
              {item.label}
            </Link>
          </div>
        );
      })}
    </aside>
  );
}
