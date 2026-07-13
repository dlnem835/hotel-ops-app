"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { ACCOUNT_SETUP_PATH } from "@/app/lib/account-setup/account-setup-client";
import {
  isAccountOnboardingPath,
  isPlatformAdminAppPath,
  isPublicAppPath,
  resolveRedirectForPath,
} from "@/app/lib/role-permissions";

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const { permissions, loading, accountSetupComplete } = useRoleAccess();

  useEffect(() => {
    if (
      loading ||
      !pathname ||
      isPublicAppPath(pathname) ||
      isPlatformAdminAppPath(pathname) ||
      isAccountOnboardingPath(pathname)
    ) {
      return;
    }

    // UX-only redirect for incomplete accounts. The security boundary is the
    // server tenant data layer, which returns 403 regardless of this redirect.
    if (accountSetupComplete === false) {
      window.location.replace(ACCOUNT_SETUP_PATH);
      return;
    }

    if (!permissions) {
      return;
    }

    const redirectTo = resolveRedirectForPath(permissions, pathname);
    if (redirectTo && redirectTo !== pathname) {
      window.location.replace(redirectTo);
    }
  }, [loading, pathname, permissions, accountSetupComplete]);

  return null;
}
