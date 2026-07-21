"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { useAdministrationApi } from "@/app/components/administration/administration-context";
import {
  ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS,
  PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS,
  accessScopeFromOrgRole,
  inviteRoleFromAccessScope,
  inviteRoleFromOrgRole,
  type AdministratorAccessScope,
  type AdministratorInviteRole,
} from "@/app/lib/platform-admin/roles";
import type {
  AdminOrganizationInvitation,
  AdminOrganizationModule,
  AdminPropertySummary,
} from "@/app/lib/platform-admin/types";
import {
  MODULE_PERMISSION_KEYS,
  MODULE_PERMISSION_LABELS,
  createEmptyPermissions,
  normalizeModulePermissions,
  type ModulePermissions,
} from "@/app/lib/role-permissions";
import { ADMIN_PORTAL_MODULE_KEY } from "@/app/lib/platform-admin/organization-module-keys";
import AdminModalFrame from "./AdminModalFrame";
import AdminPropertyMultiSelect from "./AdminPropertyMultiSelect";

type AdminEditAdministratorModalProps = {
  open: boolean;
  organizationId: number;
  invitation: AdminOrganizationInvitation | null;
  properties: AdminPropertySummary[];
  modules: AdminOrganizationModule[];
  onClose: () => void;
  onSaved: (invitation: AdminOrganizationInvitation) => void;
  onError: (message: string) => void;
};

function buildInitialModules(
  invitation: AdminOrganizationInvitation | null,
  modules: AdminOrganizationModule[]
): ModulePermissions {
  const enabled = new Set(
    modules.filter((module) => module.enabled).map((module) => module.moduleKey)
  );
  const base = normalizeModulePermissions(
    invitation?.modulePermissions ?? createEmptyPermissions()
  );
  const next = createEmptyPermissions();
  for (const key of MODULE_PERMISSION_KEYS) {
    next[key] = Boolean(base[key]) && enabled.has(key);
  }
  return next;
}

function isAccessReduction(input: {
  isPrimary: boolean;
  beforeRole: AdministratorInviteRole;
  afterRole: AdministratorInviteRole;
  beforePropertyIds: number[];
  afterPropertyIds: number[];
  beforeModules: ModulePermissions;
  afterModules: ModulePermissions;
}): boolean {
  if (input.isPrimary) return false;
  if (
    input.beforeRole === "organization_admin" &&
    input.afterRole === "property_administrator"
  ) {
    return true;
  }
  if (input.afterRole === "property_administrator") {
    const removed = input.beforePropertyIds.some(
      (id) => !input.afterPropertyIds.includes(id)
    );
    if (removed) return true;
  }
  return MODULE_PERMISSION_KEYS.some(
    (key) => input.beforeModules[key] && !input.afterModules[key]
  );
}

export default function AdminEditAdministratorModal({
  open,
  organizationId,
  invitation,
  properties,
  modules,
  onClose,
  onSaved,
  onError,
}: AdminEditAdministratorModalProps) {
  const { basePath, capabilities } = useAdministrationApi();
  const canManageEntitlement = capabilities
    ? capabilities.canManageOrgAdminEntitlement
    : true;
  const enabledModules = useMemo(
    () =>
      modules.filter(
        (module) =>
          module.enabled && module.moduleKey !== ADMIN_PORTAL_MODULE_KEY
      ),
    [modules]
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [accessScope, setAccessScope] =
    useState<AdministratorAccessScope>("entire_organization");
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [moduleState, setModuleState] = useState<ModulePermissions>(
    createEmptyPermissions()
  );
  const [confirmReduction, setConfirmReduction] = useState(false);
  const [orgAdminPortalAccess, setOrgAdminPortalAccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invitation) return;
    setFirstName(invitation.firstName);
    setLastName(invitation.lastName);
    setJobTitle(invitation.jobTitle || "Administrator");
    setOrgAdminPortalAccess(Boolean(invitation.orgAdminPortalAccess));
    setAccessScope(
      invitation.isPrimary
        ? "entire_organization"
        : accessScopeFromOrgRole(invitation.orgRole)
    );
    setPropertyIds(
      invitation.assignedPropertyIds.length > 0
        ? [...invitation.assignedPropertyIds]
        : [invitation.propertyId]
    );
    setModuleState(buildInitialModules(invitation, modules));
    setConfirmReduction(false);
    setLocalError(null);
  }, [open, invitation, modules]);

  if (!open || !invitation) {
    return null;
  }

  const isPrimary = invitation.isPrimary;
  const role = inviteRoleFromAccessScope(accessScope);
  const isEntireOrganization = accessScope === "entire_organization";
  const initialRole = invitation.isPrimary
    ? ("organization_admin" as const)
    : inviteRoleFromOrgRole(invitation.orgRole);
  const initialModules = buildInitialModules(invitation, modules);
  const needsReductionConfirm = isAccessReduction({
    isPrimary,
    beforeRole: initialRole,
    afterRole: role,
    beforePropertyIds: invitation.assignedPropertyIds,
    afterPropertyIds: propertyIds,
    beforeModules: initialModules,
    afterModules: moduleState,
  });

  const usernameDisplay = invitation.username?.trim()
    ? invitation.username
    : "Not yet created — account setup incomplete";

  const dirty =
    firstName.trim() !== invitation.firstName ||
    lastName.trim() !== invitation.lastName ||
    (jobTitle.trim() || "Administrator") !==
      (invitation.jobTitle || "Administrator") ||
    (!isPrimary && role !== inviteRoleFromOrgRole(invitation.orgRole)) ||
    (!isPrimary &&
      JSON.stringify([...propertyIds].sort((a, b) => a - b)) !==
        JSON.stringify(
          [
            ...(invitation.assignedPropertyIds.length > 0
              ? invitation.assignedPropertyIds
              : [invitation.propertyId]),
          ].sort((a, b) => a - b)
        )) ||
    (canManageEntitlement &&
      orgAdminPortalAccess !== Boolean(invitation.orgAdminPortalAccess));

  const jobTitleSuggestions = isEntireOrganization
    ? ORGANIZATION_ADMIN_JOB_TITLE_SUGGESTIONS
    : PROPERTY_ADMIN_JOB_TITLE_SUGGESTIONS;

  function requestClose() {
    if (submitting) return;
    if (dirty) {
      const discard = window.confirm(
        "You have unsaved changes. Close without saving?"
      );
      if (!discard) return;
    }
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;

    const payloadPropertyIds = isPrimary
      ? [invitation.propertyId]
      : isEntireOrganization
        ? [propertyIds[0] ?? invitation.propertyId]
        : propertyIds;

    if (!isPrimary && payloadPropertyIds.length === 0) {
      const message = isEntireOrganization
        ? "Select a default landing property."
        : "Select at least one property.";
      setLocalError(message);
      onError(message);
      return;
    }

    if (needsReductionConfirm && !confirmReduction) {
      const message = "Confirm the access reduction before saving.";
      setLocalError(message);
      onError(message);
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    onError("");

    const response = await adminFetch(
      `${basePath}/organizations/${organizationId}/invitations/${invitation.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          jobTitle: jobTitle.trim(),
          role,
          propertyIds: payloadPropertyIds,
          modulePermissions: moduleState,
          confirmAccessReduction: needsReductionConfirm && confirmReduction,
          ...(canManageEntitlement ? { orgAdminPortalAccess } : {}),
        }),
      }
    );

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      const message = body?.error ?? `Update failed (${response.status})`;
      setLocalError(message);
      onError(message);
      return;
    }

    const body = (await response.json()) as { invitation: AdminOrganizationInvitation };
    onSaved(body.invitation);
  }

  return (
    <AdminModalFrame
      open={open}
      title="Edit Leader"
      titleId="admin-edit-administrator-title"
      wide
      lockClose={submitting}
      closeOnBackdrop={!submitting}
      onClose={requestClose}
    >
      <p className="admin-portal__muted">
        {isPrimary
          ? "Primary Owner name and job title can be edited. Access Scope and Primary Owner status change only through Transfer Primary Ownership."
          : "Update profile, Access Scope, property assignments, and module permissions. Email cannot be changed here."}
      </p>

      {localError ? (
        <p className="admin-portal__confirm-warning">{localError}</p>
      ) : null}

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        <section className="admin-portal__edit-section">
          <h4 className="admin-portal__edit-section-title">Profile</h4>
          <div className="admin-portal__field">
            <span>Email</span>
            <p className="admin-portal__static-value">{invitation.email}</p>
            <span className="admin-portal__muted">
              Use Change Email (Platform Owner) to update the delivery address.
            </span>
          </div>
          <div className="admin-portal__field">
            <span>Username</span>
            <p className="admin-portal__static-value">{usernameDisplay}</p>
            <span className="admin-portal__muted">
              Login username created during account setup. Not the same as email.
            </span>
          </div>
          <label className="admin-portal__field">
            <span>First name</span>
            <input
              type="text"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
              disabled={submitting}
            />
          </label>
          <label className="admin-portal__field">
            <span>Last name</span>
            <input
              type="text"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
              disabled={submitting}
            />
          </label>
          <label className="admin-portal__field">
            <span>Job title</span>
            <input
              type="text"
              value={jobTitle}
              onChange={(event) => setJobTitle(event.target.value)}
              list="admin-edit-job-title-suggestions"
              maxLength={80}
              disabled={submitting}
            />
            <datalist id="admin-edit-job-title-suggestions">
              {jobTitleSuggestions.map((title) => (
                <option key={title} value={title} />
              ))}
            </datalist>
            <span className="admin-portal__muted">
              Visible leadership title. Does not change authorization.
            </span>
          </label>
        </section>

        <section className="admin-portal__edit-section">
          <h4 className="admin-portal__edit-section-title">Access Scope</h4>
          {isPrimary ? (
            <>
              <div className="admin-portal__field">
                <span>Access Scope</span>
                <p className="admin-portal__static-value">Entire Organization</p>
                <span className="admin-portal__muted">
                  Includes every current property and any properties added later.
                </span>
              </div>
            </>
          ) : (
            <>
              <fieldset className="admin-portal__field">
                <legend>Access Scope</legend>
                <div className="admin-portal__checkbox-grid">
                  <label className="admin-portal__checkbox-field">
                    <input
                      type="radio"
                      name="edit-access-scope"
                      checked={accessScope === "entire_organization"}
                      onChange={() => {
                        setAccessScope("entire_organization");
                        setConfirmReduction(false);
                        if (propertyIds.length === 0) {
                          setPropertyIds([invitation.propertyId]);
                        } else {
                          setPropertyIds([propertyIds[0]]);
                        }
                      }}
                      disabled={submitting}
                    />
                    <span>
                      <strong>Entire Organization</strong>
                      <br />
                      <span className="admin-portal__muted">
                        Every current hotel and properties added later.
                      </span>
                    </span>
                  </label>
                  <label className="admin-portal__checkbox-field">
                    <input
                      type="radio"
                      name="edit-access-scope"
                      checked={accessScope === "selected_properties"}
                      onChange={() => {
                        setAccessScope("selected_properties");
                        setConfirmReduction(false);
                      }}
                      disabled={submitting}
                    />
                    <span>
                      <strong>Selected Properties</strong>
                      <br />
                      <span className="admin-portal__muted">
                        Only assigned hotels.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            </>
          )}
        </section>

        {canManageEntitlement ? (
          <section className="admin-portal__edit-section">
            <h4 className="admin-portal__edit-section-title">Admin Portal</h4>
            <label className="admin-portal__checkbox-field">
              <input
                type="checkbox"
                checked={orgAdminPortalAccess}
                onChange={(event) => setOrgAdminPortalAccess(event.target.checked)}
                disabled={submitting}
              />
              <span>
                <strong>Grant Admin Portal access</strong>
                <br />
                <span className="admin-portal__muted">
                  One Eyrie-controlled. Adds the Admin Portal to this user&apos;s
                  navigation (/admin-portal). Unchecking removes the Admin Portal
                  and its sidebar item. Property access is unchanged.
                </span>
              </span>
            </label>
          </section>
        ) : null}

        <section className="admin-portal__edit-section">
          <h4 className="admin-portal__edit-section-title">Properties</h4>
          {isPrimary || isEntireOrganization ? (
            <>
              <p className="admin-portal__static-value">All properties</p>
              <span className="admin-portal__muted">
                {isPrimary
                  ? "Primary Owner property access cannot be reduced here."
                  : "Organization Administrators access every active property, including properties added later."}
              </span>
              {!isPrimary && isEntireOrganization && properties.length > 1 ? (
                <label className="admin-portal__field">
                  <span>Default landing property</span>
                  <select
                    value={String(propertyIds[0] ?? invitation.propertyId)}
                    onChange={(event) => {
                      setPropertyIds([Number.parseInt(event.target.value, 10)]);
                      setConfirmReduction(false);
                    }}
                    disabled={submitting}
                  >
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : (
            <div className="admin-portal__field">
              <span>Selected properties</span>
              <AdminPropertyMultiSelect
                properties={properties}
                value={propertyIds}
                onChange={(next) => {
                  setPropertyIds(next);
                  setConfirmReduction(false);
                }}
                disabled={submitting}
              />
            </div>
          )}
        </section>

        <section className="admin-portal__edit-section">
          <h4 className="admin-portal__edit-section-title">Module permissions</h4>
          {isPrimary ? (
            <p className="admin-portal__muted">
              Primary Owner module permissions are not editable in this workflow.
            </p>
          ) : enabledModules.length === 0 ? (
            <p className="admin-portal__muted">
              No organization modules are enabled. Enable modules under Module
              controls first.
            </p>
          ) : (
            <div className="admin-portal__checkbox-grid">
              {enabledModules.map((module) => {
                const key = module.moduleKey as (typeof MODULE_PERMISSION_KEYS)[number];
                return (
                  <label key={key} className="admin-portal__checkbox-field">
                    <input
                      type="checkbox"
                      checked={Boolean(moduleState[key])}
                      onChange={(event) => {
                        setModuleState((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }));
                        setConfirmReduction(false);
                      }}
                      disabled={submitting}
                    />
                    <span>{MODULE_PERMISSION_LABELS[key] ?? key}</span>
                  </label>
                );
              })}
            </div>
          )}
        </section>

        {needsReductionConfirm ? (
          <label className="admin-portal__checkbox-field admin-portal__reduction-confirm">
            <input
              type="checkbox"
              checked={confirmReduction}
              onChange={(event) => setConfirmReduction(event.target.checked)}
              disabled={submitting}
            />
            <span>
              I confirm this save reduces leader access (Access Scope, properties,
              and/or modules).
            </span>
          </label>
        ) : null}

        <div className="admin-portal__form-actions">
          <button
            type="button"
            className="admin-portal__button"
            onClick={requestClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </AdminModalFrame>
  );
}
