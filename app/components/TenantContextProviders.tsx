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
import { clearReportPropertyNameCache } from "@/app/reports/lib/report-property";
import type {
  TenantActiveProperty,
  TenantContextResponse,
  TenantOrganizationSummary,
  TenantPropertySummary,
} from "@/app/lib/tenant/types";
import { supabase } from "@/app/supabaseClient";

const SWITCH_ERROR_MESSAGE =
  "We couldn’t switch properties. Please try again.";

type TenantContextInternalValue = {
  context: TenantContextResponse | null;
  loading: boolean;
  switching: boolean;
  switchError: string | null;
  error: string | null;
  clearSwitchError: () => void;
  refresh: (requestedPropertyId?: number | null) => Promise<void>;
  switchActiveProperty: (propertyId: number) => Promise<void>;
};

const TenantContextInternal = createContext<TenantContextInternalValue | null>(
  null
);

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
  const session =
    (await waitForInitialAuthSession()) ??
    (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    return null;
  }

  return fetchTenantContext(session.access_token, requestedPropertyId);
}

function toActiveProperty(
  property: TenantPropertySummary
): TenantActiveProperty {
  return {
    id: property.id,
    name: property.name,
    brand: property.brand,
    timezone: property.timezone,
    organizationId: property.organizationId,
    role: property.role,
  };
}

export function TenantContextInternalProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [context, setContext] = useState<TenantContextResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const clearSwitchError = useCallback(() => {
    setSwitchError(null);
  }, []);

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
        loadError instanceof Error
          ? loadError.message
          : "Unable to load tenant context";
      setError(message);
      setContext(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchActiveProperty = useCallback(async (propertyId: number) => {
    const previousContext = context;
    const previousPropertyId = previousContext?.activeProperty.id ?? null;

    if (previousPropertyId === propertyId) {
      return;
    }

    if (switching) {
      return;
    }

    const targetSummary = previousContext?.properties.find(
      (property) => property.id === propertyId
    );
    if (!previousContext || !targetSummary) {
      setSwitchError(SWITCH_ERROR_MESSAGE);
      return;
    }

    setSwitching(true);
    setSwitchError(null);
    clearReportPropertyNameCache();

    // Persist before any refetch so tenantFetch attaches the new property id.
    persistActivePropertyId(propertyId);

    // Optimistic selector update; remount key follows activeProperty.id.
    setContext({
      ...previousContext,
      activeProperty: toActiveProperty(targetSummary),
    });

    try {
      const nextContext = await loadTenantContext(propertyId);
      if (!nextContext || nextContext.activeProperty.id !== propertyId) {
        throw new Error("Unauthorized or missing property context");
      }

      clearReportPropertyNameCache();
      setContext(nextContext);
      persistActivePropertyId(nextContext.activeProperty.id);
    } catch {
      if (previousPropertyId != null) {
        persistActivePropertyId(previousPropertyId);
      } else {
        clearStoredActivePropertyId();
      }
      setContext(previousContext);
      setSwitchError(SWITCH_ERROR_MESSAGE);
    } finally {
      setSwitching(false);
    }
  }, [context, switching]);

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
        setSwitchError(null);
        setSwitching(false);
        setLoading(false);
        clearStoredActivePropertyId();
        clearReportPropertyNameCache();
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
      switching,
      switchError,
      error,
      clearSwitchError,
      refresh,
      switchActiveProperty,
    }),
    [
      context,
      loading,
      switching,
      switchError,
      error,
      clearSwitchError,
      refresh,
      switchActiveProperty,
    ]
  );

  return (
    <TenantContextInternal.Provider value={value}>
      {children}
    </TenantContextInternal.Provider>
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

export function OrganizationContextProvider({
  children,
}: {
  children: ReactNode;
}) {
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

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
}

type PropertyContextValue = {
  properties: TenantPropertySummary[];
  activeProperty: TenantContextResponse["activeProperty"] | null;
  propertyId: number | null;
  organizationId: number | null;
  loading: boolean;
  switching: boolean;
  switchError: string | null;
  error: string | null;
  clearSwitchError: () => void;
  setActivePropertyId: (propertyId: number) => Promise<void>;
};

const PropertyContext = createContext<PropertyContextValue>({
  properties: [],
  activeProperty: null,
  propertyId: null,
  organizationId: null,
  loading: true,
  switching: false,
  switchError: null,
  error: null,
  clearSwitchError: () => {},
  setActivePropertyId: async () => {},
});

export function usePropertyContext() {
  return useContext(PropertyContext);
}

export function PropertyContextProvider({ children }: { children: ReactNode }) {
  const {
    context,
    loading,
    switching,
    switchError,
    error,
    clearSwitchError,
    switchActiveProperty,
  } = useTenantContextInternal();

  const value = useMemo<PropertyContextValue>(
    () => ({
      properties: context?.properties ?? [],
      activeProperty: context?.activeProperty ?? null,
      propertyId: context?.activeProperty?.id ?? null,
      organizationId: context?.activeProperty?.organizationId ?? null,
      loading,
      switching,
      switchError,
      error,
      clearSwitchError,
      setActivePropertyId: switchActiveProperty,
    }),
    [
      context,
      loading,
      switching,
      switchError,
      error,
      clearSwitchError,
      switchActiveProperty,
    ]
  );

  return (
    <PropertyContext.Provider value={value}>{children}</PropertyContext.Provider>
  );
}
