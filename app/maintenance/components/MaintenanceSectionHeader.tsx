"use client";

import { ONE_EYRIE } from "@/app/lib/oneEyrieColors";

type MaintenanceSectionHeaderProps = {
  title: string;
  uppercase?: boolean;
  showDivider?: boolean;
};

export default function MaintenanceSectionHeader({
  title,
  uppercase = false,
  showDivider = false,
}: MaintenanceSectionHeaderProps) {
  return (
    <div className="maintenance-section-header">
      <h2
        className={`maintenance-section-header__title${uppercase ? " maintenance-section-header__title--upper" : ""}`}
        style={{
          margin: 0,
          color: uppercase ? ONE_EYRIE.gold : ONE_EYRIE.text,
          fontSize: uppercase ? "11px" : "15px",
          fontWeight: 800,
          letterSpacing: uppercase ? "0.12em" : "normal",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
      {showDivider ? <div className="maintenance-section-header__divider" aria-hidden /> : null}
    </div>
  );
}
