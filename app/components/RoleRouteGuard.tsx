"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import {
  isPlatformAdminAppPath,
  isPublicAppPath,
  resolveRedirectForPath,
} from "@/app/lib/role-permissions";

export default function RoleRouteGuard() {
  const pathname = usePathname();
  const { permissions, loading } = useRoleAccess();

  useEffect(() => {
    if (
      loading ||
      !pathname ||
      isPublicAppPath(pathname) ||
      isPlatformAdminAppPath(pathname) ||
      !permissions
    ) {
      return;
    }

    const redirectTo = resolveRedirectForPath(permissions, pathname);
    if (redirectTo && redirectTo !== pathname) {
      window.location.replace(redirectTo);
    }
  }, [loading, pathname, permissions]);

  return null;
}
