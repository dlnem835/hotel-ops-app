"use client";

import { orgAdminFetch } from "@/app/lib/org-admin/org-admin-fetch";

/**
 * Client probe for the current user's Organization Administration entitlement.
 * Drives the "Organization" sidebar item. Fails closed (returns false) on any
 * error so the item is hidden unless access is confirmed.
 */
export async function fetchOrganizationAdministrationAccess(): Promise<boolean> {
  try {
    const response = await orgAdminFetch("/api/org-admin/access");
    if (!response.ok) return false;
    const body = (await response.json().catch(() => null)) as
      | { hasAccess?: boolean }
      | null;
    return Boolean(body?.hasAccess);
  } catch {
    return false;
  }
}
