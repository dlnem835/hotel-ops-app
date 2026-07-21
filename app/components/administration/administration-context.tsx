"use client";

/**
 * Neutral administration context shared by the internal Platform Admin portal
 * (/admin) and the customer Organization Administration portal
 * (/settings/organization).
 *
 * The leadership components (administrators table, invite/edit/transfer modals)
 * are identical between portals. Only two things differ:
 *   1. `basePath` — the API namespace the component talks to
 *        • Platform Admin:        /api/admin
 *        • Organization Admin:    /api/org-admin
 *   2. `capabilities` — which destructive/privileged actions are offered.
 *
 * Default context = Platform Admin behavior. When `capabilities` is null the
 * administrators table derives them from `/api/admin/me` exactly as before, so
 * the existing /admin portal is completely unchanged.
 */

import { createContext, useContext, type ReactNode } from "react";

/** Privileged administrator actions that vary by portal + role. */
export type AdministrationCapabilities = {
  /** Revoke a leader's org/property access (history preserved). */
  canRemove: boolean;
  /** Change a leader's contact/login email. */
  canChangeEmail: boolean;
  /** Transfer Primary Owner designation. Platform-only for now. */
  canTransferOwnership: boolean;
  /** Permanently delete a Supabase Auth account. Platform Owner only. */
  canPermanentlyDeleteAuth: boolean;
  /** Dismiss a revoked invitation card without deleting the Auth account. */
  canDismissRevoked: boolean;
  /**
   * Edit the organization's LEGAL identity (legal/company name). Slug, id, and
   * status are always platform-only regardless of this flag. One Eyrie only.
   */
  canEditLegalIdentity: boolean;
  /**
   * Grant/revoke the Organization Administration entitlement (the checkbox in
   * invite + edit flows). One Eyrie only — customers must never see or set it.
   */
  canManageOrgAdminEntitlement: boolean;
};

export type AdministrationApiValue = {
  /** API namespace, e.g. "/api/admin" or "/api/org-admin". No trailing slash. */
  basePath: string;
  /**
   * Explicit capability set for this portal. When null, the administrators
   * table falls back to deriving capabilities from `/api/admin/me`
   * (the pre-existing Platform Admin behavior).
   */
  capabilities: AdministrationCapabilities | null;
};

/** Full platform-owner capability set (everything enabled). */
export const PLATFORM_OWNER_CAPABILITIES: AdministrationCapabilities = {
  canRemove: true,
  canChangeEmail: true,
  canTransferOwnership: true,
  canPermanentlyDeleteAuth: true,
  canDismissRevoked: true,
  canEditLegalIdentity: true,
  canManageOrgAdminEntitlement: true,
};

/** No privileged actions (safe default). */
export const NO_ADMINISTRATION_CAPABILITIES: AdministrationCapabilities = {
  canRemove: false,
  canChangeEmail: false,
  canTransferOwnership: false,
  canPermanentlyDeleteAuth: false,
  canDismissRevoked: false,
  canEditLegalIdentity: false,
  canManageOrgAdminEntitlement: false,
};

/**
 * Customer Organization Admin capabilities: manage people, not the platform.
 * Can remove access (history preserved) and change emails, but cannot transfer
 * ownership, permanently delete Auth accounts, or dismiss revoked cards.
 */
export const ORGANIZATION_ADMIN_CAPABILITIES: AdministrationCapabilities = {
  canRemove: true,
  canChangeEmail: true,
  canTransferOwnership: false,
  canPermanentlyDeleteAuth: false,
  canDismissRevoked: false,
  canEditLegalIdentity: false,
  canManageOrgAdminEntitlement: false,
};

const DEFAULT_ADMINISTRATION_API: AdministrationApiValue = {
  basePath: "/api/admin",
  capabilities: null,
};

const AdministrationApiContext = createContext<AdministrationApiValue>(
  DEFAULT_ADMINISTRATION_API
);

type AdministrationApiProviderProps = {
  basePath: string;
  capabilities: AdministrationCapabilities | null;
  children: ReactNode;
};

export function AdministrationApiProvider({
  basePath,
  capabilities,
  children,
}: AdministrationApiProviderProps) {
  return (
    <AdministrationApiContext.Provider value={{ basePath, capabilities }}>
      {children}
    </AdministrationApiContext.Provider>
  );
}

/** Read the active administration API context (defaults to Platform Admin). */
export function useAdministrationApi(): AdministrationApiValue {
  return useContext(AdministrationApiContext);
}
