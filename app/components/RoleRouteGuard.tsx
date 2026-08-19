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
  isPrintMedia,
  resolvePreferredShell,
  subscribePhoneViewport,
  subscribePrintSession,
} from "@/app/lib/viewport-interface";

/**
 * Client UX redirects for account setup and mobile/desktop shell selection.
 * Server tenant APIs remain the security boundary.
 */
export default function RoleRouteGuard() {
  const pathname = usePathname();
  const { permissions, loading, accountSetupComplete } = useRoleAccess();
  const redirectingRef = useRef(false);
  const printingRef = useRef(false);

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
      if (printingRef.current || isPrintMedia()) return;

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

    let viewportTimer: number | null = null;
    const unsubscribeViewport = subscribePhoneViewport(() => {
      if (printingRef.current || isPrintMedia()) return;
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      // Print dialogs can briefly change reported viewport width before
      // beforeprint/print media is visible; wait so we do not bounce Home.
      viewportTimer = window.setTimeout(() => {
        viewportTimer = null;
        if (printingRef.current || isPrintMedia()) return;
        redirectingRef.current = false;
        applyShellAndPermissionRedirects();
      }, 400);
    });
    const unsubscribePrint = subscribePrintSession((printing) => {
      printingRef.current = printing;
    });

    return () => {
      if (viewportTimer !== null) window.clearTimeout(viewportTimer);
      unsubscribeViewport();
      unsubscribePrint();
    };
  }, [loading, pathname, permissions, accountSetupComplete]);

  return null;
}
