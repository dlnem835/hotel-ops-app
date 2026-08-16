"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { ACCOUNT_SETUP_PATH } from "@/app/lib/account-setup/account-setup-client";
import { resolveHomeForPermissions } from "@/app/lib/resolve-app-home";
import { isMobilePmSessionRoute } from "@/app/maintenance/lib/pm-session-return";
import {
  canAccessPath,
  isAccountOnboardingPath,
  isMobileAppPath,
  isPlatformAdminAppPath,
  isPublicAppPath,
  resolveRedirectForPath,
} from "@/app/lib/role-permissions";
import {
  resolvePreferredShell,
  subscribePhoneViewport,
} from "@/app/lib/viewport-interface";

/**
 * Client UX redirects for account setup and mobile/desktop shell selection.
 * Server tenant APIs remain the security boundary.
 */
export default function RoleRouteGuard() {
  const pathname = usePathname();
  const { permissions, loading, accountSetupComplete } = useRoleAccess();
  const redirectingRef = useRef(false);

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

    if (accountSetupComplete === false) {
      if (!redirectingRef.current) {
        redirectingRef.current = true;
        window.location.replace(ACCOUNT_SETUP_PATH);
      }
      return;
    }

    if (!permissions) {
      return;
    }

    function applyShellAndPermissionRedirects() {
      if (redirectingRef.current || !pathname || !permissions) return;

      const shell = resolvePreferredShell();
      const onMobile = isMobileAppPath(pathname);
      const searchParams = new URLSearchParams(window.location.search);

      if (shell === "mobile" && isMobilePmSessionRoute(pathname, searchParams)) {
        if (!canAccessPath(permissions, pathname)) {
          redirectingRef.current = true;
          window.location.replace(resolveHomeForPermissions(permissions));
        }
        return;
      }

      if (shell === "mobile" && !onMobile) {
        const target = resolveHomeForPermissions(permissions);
        if (target !== pathname) {
          redirectingRef.current = true;
          window.location.replace(target);
        }
        return;
      }

      if (shell === "desktop" && onMobile) {
        const target = resolveHomeForPermissions(permissions);
        if (target !== pathname) {
          redirectingRef.current = true;
          window.location.replace(target);
        }
        return;
      }

      const redirectTo = resolveRedirectForPath(permissions, pathname);
      if (redirectTo && redirectTo !== pathname) {
        redirectingRef.current = true;
        window.location.replace(redirectTo);
      }
    }

    applyShellAndPermissionRedirects();

    const unsubscribe = subscribePhoneViewport(() => {
      redirectingRef.current = false;
      applyShellAndPermissionRedirects();
    });

    return () => {
      unsubscribe();
    };
  }, [loading, pathname, permissions, accountSetupComplete]);

  return null;
}
