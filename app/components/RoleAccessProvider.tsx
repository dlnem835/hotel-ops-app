"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchTeamMemberAccess } from "@/app/lib/current-user-role";
import {
  getDesktopNavItemsForPermissions,
  getMobileModulesForPermissions,
  type MobileModuleKey,
  type ModulePermissions,
  type UserAccessProfile,
} from "@/app/lib/role-permissions";
import { subscribeAuthSession } from "@/app/lib/auth-session";

type RoleAccessContextValue = {
  access: UserAccessProfile | null;
  permissions: ModulePermissions | null;
  loading: boolean;
  desktopNavItems: ReturnType<typeof getDesktopNavItemsForPermissions>;
  mobileModules: MobileModuleKey[];
};

const RoleAccessContext = createContext<RoleAccessContextValue>({
  access: null,
  permissions: null,
  loading: true,
  desktopNavItems: [],
  mobileModules: [],
});

export function useRoleAccess() {
  return useContext(RoleAccessContext);
}

export default function RoleAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<UserAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadAccess() {
      const nextAccess = await fetchTeamMemberAccess();
      if (!mounted) return;
      setAccess(nextAccess);
      setLoading(false);
    }

    void loadAccess();

    const unsubscribe = subscribeAuthSession((session) => {
      if (!session) {
        setAccess(null);
        setLoading(false);
        return;
      }
      void loadAccess();
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo<RoleAccessContextValue>(() => {
    const permissions = access?.permissions ?? null;
    return {
      access,
      permissions,
      loading,
      desktopNavItems: permissions ? getDesktopNavItemsForPermissions(permissions) : [],
      mobileModules: permissions ? getMobileModulesForPermissions(permissions) : [],
    };
  }, [access, loading]);

  return (
    <RoleAccessContext.Provider value={value}>{children}</RoleAccessContext.Provider>
  );
}

export type { MobileModuleKey };
