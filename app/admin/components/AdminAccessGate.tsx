"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import {
  adminLoginUrl,
  isAdminAccessDeniedPath,
} from "@/app/lib/platform-admin/admin-paths";
import type { PlatformAdminMeResponse } from "@/app/lib/platform-admin/types";
import AdminAccessDenied from "./AdminAccessDenied";
import AdminShell from "./AdminShell";

type GateState = "loading" | "denied" | "allowed";

type AdminAccessGateProps = {
  children: ReactNode;
};

export default function AdminAccessGate({ children }: AdminAccessGateProps) {
  const pathname = usePathname();
  const [state, setState] = useState<GateState>("loading");
  const [adminProfile, setAdminProfile] = useState<PlatformAdminMeResponse | null>(
    null
  );

  useEffect(() => {
    let mounted = true;

    async function verifyAccess() {
      const session = await waitForInitialAuthSession();
      if (!session) {
        window.location.replace(adminLoginUrl());
        return;
      }

      if (isAdminAccessDeniedPath(pathname)) {
        if (mounted) {
          setAdminProfile(null);
          setState("denied");
        }
        return;
      }

      const response = await adminFetch("/api/admin/me");

      if (!mounted) {
        return;
      }

      if (response.status === 401) {
        window.location.replace(adminLoginUrl());
        return;
      }

      if (response.status === 403) {
        window.location.replace("/admin/access-denied");
        return;
      }

      if (!response.ok) {
        setAdminProfile(null);
        setState("denied");
        return;
      }

      const profile = (await response.json()) as PlatformAdminMeResponse;
      setAdminProfile(profile);
      setState("allowed");
    }

    setState("loading");
    void verifyAccess();

    return () => {
      mounted = false;
    };
  }, [pathname]);

  if (state === "loading") {
    return <div className="admin-portal__loading">Verifying platform access…</div>;
  }

  if (state === "denied" || isAdminAccessDeniedPath(pathname)) {
    return <AdminAccessDenied />;
  }

  return <AdminShell role={adminProfile?.role}>{children}</AdminShell>;
}
