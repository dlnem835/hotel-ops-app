"use client";

import { useEffect, useState } from "react";

export type InspectionBreakpoint = "mobile" | "tablet" | "desktop";

const QUERIES: Record<InspectionBreakpoint, string> = {
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
};

function getBreakpoint(): InspectionBreakpoint {
  if (typeof window === "undefined") {
    return "desktop";
  }
  if (window.matchMedia(QUERIES.mobile).matches) {
    return "mobile";
  }
  if (window.matchMedia(QUERIES.tablet).matches) {
    return "tablet";
  }
  return "desktop";
}

export function useInspectionBreakpoint(): InspectionBreakpoint {
  const [breakpoint, setBreakpoint] = useState<InspectionBreakpoint>("desktop");

  useEffect(() => {
    const update = () => setBreakpoint(getBreakpoint());
    update();

    const mobile = window.matchMedia(QUERIES.mobile);
    const tablet = window.matchMedia(QUERIES.tablet);
    const desktop = window.matchMedia(QUERIES.desktop);

    mobile.addEventListener("change", update);
    tablet.addEventListener("change", update);
    desktop.addEventListener("change", update);

    return () => {
      mobile.removeEventListener("change", update);
      tablet.removeEventListener("change", update);
      desktop.removeEventListener("change", update);
    };
  }, []);

  return breakpoint;
}

export function useIsMobileInspectionLayout(): boolean {
  const breakpoint = useInspectionBreakpoint();
  return breakpoint === "mobile";
}
