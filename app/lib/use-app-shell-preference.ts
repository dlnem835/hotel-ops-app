"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useRoleAccess } from "@/app/components/RoleAccessProvider";
import { resolveHomeForPermissions } from "@/app/lib/resolve-app-home";
import {
  persistInterfacePreference,
  resolvePreferredShell,
  type AppShell,
} from "@/app/lib/viewport-interface";

export function useAppShellPreference() {
  const pathname = usePathname();
  const { permissions } = useRoleAccess();
  const [, setRevision] = useState(0);

  const shell = resolvePreferredShell();

  function setPreferredShell(next: AppShell) {
    persistInterfacePreference(next);
    setRevision((revision) => revision + 1);

    const onMobile =
      pathname === "/mobile" || (pathname?.startsWith("/mobile/") ?? false);
    const alreadyOnShell =
      (next === "mobile" && onMobile) || (next === "desktop" && !onMobile);
    if (alreadyOnShell) return;

    const target = permissions
      ? resolveHomeForPermissions(permissions, next)
      : next === "mobile"
        ? "/mobile"
        : "/";

    window.location.replace(target);
  }

  return { shell, setPreferredShell };
}
