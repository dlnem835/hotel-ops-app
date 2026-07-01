"use client";

import React from "react";

type OneEyrieDesktopHeaderActionsProps = {
  children?: React.ReactNode;
};

/** Optional module action buttons in page headers (e.g. New, Create). */
export default function OneEyrieDesktopHeaderActions({
  children,
}: OneEyrieDesktopHeaderActionsProps) {
  if (!children) return null;

  return <div className="one-eyrie-desktop-header-actions">{children}</div>;
}
