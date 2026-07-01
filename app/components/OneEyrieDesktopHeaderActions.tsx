"use client";

import React from "react";
import OneEyrieDesktopUserMenu from "@/app/components/OneEyrieDesktopUserMenu";

type OneEyrieDesktopHeaderActionsProps = {
  children?: React.ReactNode;
};

/** Desktop header actions row — module buttons plus username / logout (dashboard style). */
export default function OneEyrieDesktopHeaderActions({
  children,
}: OneEyrieDesktopHeaderActionsProps) {
  return (
    <div className="one-eyrie-desktop-header-actions">
      {children ? (
        <div className="one-eyrie-desktop-header-actions__module">{children}</div>
      ) : null}
      <OneEyrieDesktopUserMenu />
    </div>
  );
}
