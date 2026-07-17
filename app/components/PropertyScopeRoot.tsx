"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePropertyContext } from "@/app/components/TenantContextProviders";

/**
 * Remounts the hotel app tree when the active property changes so mount-only
 * data loaders refetch for the new property without a full browser reload.
 * While a switch is in flight, covers main content with a subtle loading veil
 * (sidebar stays interactive except the locked selector).
 */
export default function PropertyScopeRoot({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { propertyId, switching, switchError, clearSwitchError } =
    usePropertyContext();
  const previousPropertyIdRef = useRef<number | null>(null);
  const didMountRef = useRef(false);

  useEffect(() => {
    if (propertyId == null || switching) return;

    const previous = previousPropertyIdRef.current;
    previousPropertyIdRef.current = propertyId;

    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    if (previous != null && previous !== propertyId) {
      router.refresh();
    }
  }, [propertyId, switching, router]);

  useEffect(() => {
    if (!switchError) return;
    const timer = window.setTimeout(() => clearSwitchError(), 6000);
    return () => window.clearTimeout(timer);
  }, [switchError, clearSwitchError]);

  return (
    <div
      className={
        switching
          ? "one-eyrie-property-scope one-eyrie-property-scope--switching"
          : "one-eyrie-property-scope"
      }
    >
      {switchError ? (
        <div className="one-eyrie-property-switch-error" role="alert">
          {switchError}
        </div>
      ) : null}

      <div
        key={propertyId != null ? `property-${propertyId}` : "property-pending"}
        className="one-eyrie-property-scope__tree"
      >
        {children}
      </div>
    </div>
  );
}
