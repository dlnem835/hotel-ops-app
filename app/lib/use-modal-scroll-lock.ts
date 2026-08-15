"use client";

import { useEffect } from "react";

/** Locks both document scrolling and One Eyrie's independently scrolling content pane. */
export function useModalScrollLock(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const bodyOverflow = document.body.style.overflow;
    const htmlOverflow = document.documentElement.style.overflow;
    const panes = Array.from(
      document.querySelectorAll<HTMLElement>(".one-eyrie-main-content")
    );
    const paneOverflow = panes.map((pane) => pane.style.overflow);
    const paneOverflowY = panes.map((pane) => pane.style.overflowY);

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    panes.forEach((pane) => {
      pane.style.overflow = "hidden";
      pane.style.overflowY = "hidden";
    });

    return () => {
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = htmlOverflow;
      panes.forEach((pane, index) => {
        pane.style.overflow = paneOverflow[index];
        pane.style.overflowY = paneOverflowY[index];
      });
    };
  }, [enabled]);
}
