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
import { fetchAccountSetupState } from "@/app/lib/account-setup/account-setup-client";
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
  /** null while unknown; true/false once resolved for the current session. */
  accountSetupComplete: boolean | null;
  desktopNavItems: ReturnType<typeof getDesktopNavItemsForPermissions>;
  mobileModules: MobileModuleKey[];
};

const RoleAccessContext = createContext<RoleAccessContextValue>({
  access: null,
  permissions: null,
  loading: true,
  accountSetupComplete: null,
  desktopNavItems: [],
  mobileModules: [],
});

export function useRoleAccess() {
  return useContext(RoleAccessContext);
}

export default function RoleAccessProvider({ children }: { children: ReactNode }) {
  const [access, setAccess] = useState<UserAccessProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountSetupComplete, setAccountSetupComplete] = useState<boolean | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    async function loadAccess() {
      const [nextAccess, setupState] = await Promise.all([
        fetchTeamMemberAccess(),
        fetchAccountSetupState(),
      ]);
      if (!mounted) return;
      setAccess(nextAccess);
      setAccountSetupComplete(
        setupState ? setupState.accountSetupComplete : null
      );
      setLoading(false);
    }

    void loadAccess();

    const unsubscribe = subscribeAuthSession((session) => {
      if (!session) {
        setAccess(null);
        setAccountSetupComplete(null);
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
      accountSetupComplete,
      desktopNavItems: permissions ? getDesktopNavItemsForPermissions(permissions) : [],
      mobileModules: permissions ? getMobileModulesForPermissions(permissions) : [],
    };
  }, [access, loading, accountSetupComplete]);

  return (
    <RoleAccessContext.Provider value={value}>{children}</RoleAccessContext.Provider>
  );
}

export type { MobileModuleKey };
