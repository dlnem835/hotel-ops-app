"use client";

import type { ReactNode } from "react";
import {
  OrganizationContextProvider,
  PropertyContextProvider,
  TenantContextInternalProvider,
} from "@/app/components/TenantContextProviders";

export default function TenantContextProviders({ children }: { children: ReactNode }) {
  return (
    <TenantContextInternalProvider>
      <OrganizationContextProvider>
        <PropertyContextProvider>{children}</PropertyContextProvider>
      </OrganizationContextProvider>
    </TenantContextInternalProvider>
  );
}

export {
  OrganizationContextProvider,
  PropertyContextProvider,
  useOrganizationContext,
  usePropertyContext,
} from "@/app/components/TenantContextProviders";
