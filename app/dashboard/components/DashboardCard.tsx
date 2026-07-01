"use client";

import Link from "next/link";
import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";
import { SETTINGS_CARD_TRANSITION } from "@/app/settings/lib/settings-ui-interactions";

type DashboardCardProps = {
  href?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
};

export function DashboardCard({ href, children, style, className }: DashboardCardProps) {
  const shell = (
    <div
      className={className}
      style={{
        background: ONE_EYRIE.surface,
        border: `1px solid ${ONE_EYRIE.border}`,
        borderRadius: "14px",
        padding: "16px",
        minWidth: 0,
        transition: SETTINGS_CARD_TRANSITION,
        ...style,
      }}
    >
      {children}
    </div>
  );

  if (!href) return shell;

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
      className="dashboard-clickable-card"
    >
      {shell}
    </Link>
  );
}

export function DashboardSectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ color: ONE_EYRIE.gold, fontWeight: 800, fontSize: "15px" }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ color: ONE_EYRIE.textSubtle, fontSize: "12px", marginTop: "4px" }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
