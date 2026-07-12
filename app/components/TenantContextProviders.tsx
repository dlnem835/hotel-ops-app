"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { subscribeAuthSession, waitForInitialAuthSession } from "@/app/lib/auth-session";
import { fetchTenantContext } from "@/app/lib/tenant/fetch-tenant-context";
import {
  clearStoredActivePropertyId,
  persistActivePropertyId,
  readStoredActivePropertyId,
} from "@/app/lib/tenant/active-property-storage";
import type {
  TenantContextResponse,
  TenantOrganizationSummary,
  TenantPropertySummary,
} from "@/app/lib/tenant/types";
import { supabase } from "@/app/supabaseClient";

type TenantContextInternalValue = {
  context: TenantContextResponse | null;
  loading: boolean;
  error: string | null;
  refresh: (requestedPropertyId?: number | null) => Promise<void>;
};

const TenantContextInternal = createContext<TenantContextInternalValue | null>(null);

export function useTenantContextInternal() {
  const value = useContext(TenantContextInternal);
  if (!value) {
    throw new Error("Tenant context providers are missing");
  }
  return value;
}

async function loadTenantContext(
  requestedPropertyId?: number | null
): Promise<TenantContextResponse | null> {
  const session = (await waitForInitialAuthSession()) ?? (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    return null;
  }

  return fetchTenantContext(session.access_token, requestedPropertyId);
}

export function TenantContextInternalProvider({ children }: { children: ReactNode }) {
  const [context, setContext] = useState<TenantContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (requestedPropertyId?: number | null) => {
    setLoading(true);
    setError(null);

    try {
      const nextContext = await loadTenantContext(requestedPropertyId);
      if (!nextContext) {
        setContext(null);
        clearStoredActivePropertyId();
        return;
      }

      setContext(nextContext);
      persistActivePropertyId(nextContext.activeProperty.id);
    } catch (loadError) {
      const message =
        loadError instanceof Error ? loadError.message : "Unable to load tenant context";
      setError(message);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      const storedPropertyId = readStoredActivePropertyId();
      await refresh(storedPropertyId);

      if (!mounted) return;
    }

    void bootstrap();

    const unsubscribe = subscribeAuthSession((session) => {
      if (!session) {
        setContext(null);
        setError(null);
        setLoading(false);
        clearStoredActivePropertyId();
        return;
      }

      const storedPropertyId = readStoredActivePropertyId();
      void refresh(storedPropertyId);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      context,
      loading,
      error,
      refresh,
    }),
    [context, loading, error, refresh]
  );

  return (
    <TenantContextInternal.Provider value={value}>{children}</TenantContextInternal.Provider>
  );
}

type OrganizationContextValue = {
  organization: TenantOrganizationSummary | null;
  organizationId: number | null;
  loading: boolean;
  error: string | null;
};

const OrganizationContext = createContext<OrganizationContextValue>({
  organization: null,
  organizationId: null,
  loading: true,
  error: null,
});

export function useOrganizationContext() {
  return useContext(OrganizationContext);
}

export function OrganizationContextProvider({ children }: { children: ReactNode }) {
  const { context, loading, error } = useTenantContextInternal();

  const value = useMemo<OrganizationContextValue>(
    () => ({
      organization: context?.organization ?? null,
      organizationId: context?.organization?.id ?? null,
      loading,
      error,
    }),
    [context, loading, error]
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

type PropertyContextValue = {
  properties: TenantPropertySummary[];
  activeProperty: TenantContextResponse["activeProperty"] | null;
  propertyId: number | null;
  organizationId: number | null;
  loading: boolean;
  error: string | null;
  setActivePropertyId: (propertyId: number) => Promise<void>;
};

const PropertyContext = createContext<PropertyContextValue>({
  properties: [],
  activeProperty: null,
  propertyId: null,
  organizationId: null,
  loading: true,
  error: null,
  setActivePropertyId: async () => {},
});

export function usePropertyContext() {
  return useContext(PropertyContext);
}

export function PropertyContextProvider({ children }: { children: ReactNode }) {
  const { context, loading, error, refresh } = useTenantContextInternal();

  const setActivePropertyId = useCallback(
    async (propertyId: number) => {
      persistActivePropertyId(propertyId);
      await refresh(propertyId);
    },
    [refresh]
  );

  const value = useMemo<PropertyContextValue>(
    () => ({
      properties: context?.properties ?? [],
      activeProperty: context?.activeProperty ?? null,
      propertyId: context?.activeProperty?.id ?? null,
      organizationId: context?.activeProperty?.organizationId ?? null,
      loading,
      error,
      setActivePropertyId,
    }),
    [context, loading, error, setActivePropertyId]
  );

  return <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>;
}
