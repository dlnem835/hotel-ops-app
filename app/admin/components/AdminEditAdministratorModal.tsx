"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import {
  ADMINISTRATOR_INVITE_ROLES,
  inviteRoleFromOrgRole,
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
  const enabledModules = useMemo(
    () => modules.filter((module) => module.enabled),
    [modules]
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [role, setRole] = useState<AdministratorInviteRole>("organization_admin");
  const [propertyIds, setPropertyIds] = useState<number[]>([]);
  const [moduleState, setModuleState] = useState<ModulePermissions>(
    createEmptyPermissions()
  );
  const [confirmReduction, setConfirmReduction] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !invitation) return;
    setFirstName(invitation.firstName);
    setLastName(invitation.lastName);
    setJobTitle(invitation.jobTitle || "Administrator");
    setRole(
      invitation.isPrimary
        ? "organization_admin"
        : inviteRoleFromOrgRole(invitation.orgRole)
    );
    setPropertyIds(
      invitation.assignedPropertyIds.length > 0
        ? [...invitation.assignedPropertyIds]
        : [invitation.propertyId]
    );
    setModuleState(buildInitialModules(invitation, modules));
    setConfirmReduction(false);
  }, [open, invitation, modules]);

  if (!open || !invitation) {
    return null;
  }

  const isPrimary = invitation.isPrimary;
  const scopeIsOrganization = role === "organization_admin";
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

  function toggleProperty(propertyId: number) {
    setPropertyIds((current) =>
      current.includes(propertyId)
        ? current.filter((id) => id !== propertyId)
        : [...current, propertyId]
    );
    setConfirmReduction(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;

    if (!scopeIsOrganization && propertyIds.length === 0) {
      onError("Select at least one property.");
      return;
    }

    if (needsReductionConfirm && !confirmReduction) {
      onError("Confirm the access reduction before saving.");
      return;
    }

    setSubmitting(true);
    onError("");

    const payloadPropertyIds = scopeIsOrganization
      ? [propertyIds[0] ?? invitation.propertyId]
      : propertyIds;

    const response = await adminFetch(
      `/api/admin/organizations/${organizationId}/invitations/${invitation.id}`,
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
        }),
      }
    );

    setSubmitting(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Update failed (${response.status})`);
      return;
    }

    const body = (await response.json()) as { invitation: AdminOrganizationInvitation };
    onSaved(body.invitation);
    onClose();
  }

  return (
    <div className="admin-portal__modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="admin-portal__modal admin-portal__modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-edit-administrator-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h3
          id="admin-edit-administrator-title"
          className="admin-portal__section-title"
        >
          Edit Administrator
        </h3>
        <p className="admin-portal__muted">
          {isPrimary
            ? "Primary Owner name and job title can be edited. Role, scope, and Primary Owner status are protected until Transfer Primary Owner exists."
            : "Update profile, role, property assignments, and module permissions. Email cannot be changed."}
        </p>

        <form className="admin-portal__form" onSubmit={handleSubmit}>
          <section className="admin-portal__edit-section">
            <h4 className="admin-portal__edit-section-title">Profile</h4>
            <label className="admin-portal__field">
              <span>Email</span>
              <input type="email" value={invitation.email} disabled readOnly />
              <span className="admin-portal__muted">
                Auth email is managed in Supabase and cannot be edited here.
              </span>
            </label>
            <label className="admin-portal__field">
              <span>First name</span>
              <input
                type="text"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
              />
            </label>
            <label className="admin-portal__field">
              <span>Last name</span>
              <input
                type="text"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
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
              />
              <datalist id="admin-edit-job-title-suggestions">
                <option value="General Manager" />
                <option value="Assistant General Manager" />
                <option value="Area General Manager" />
                <option value="Regional Director" />
                <option value="Corporate Administrator" />
              </datalist>
            </label>
          </section>

          <section className="admin-portal__edit-section">
            <h4 className="admin-portal__edit-section-title">Role &amp; scope</h4>
            {isPrimary ? (
              <p className="admin-portal__muted">
                Role: Primary Owner · Scope: Entire organization
              </p>
            ) : (
              <>
                <label className="admin-portal__field">
                  <span>Administrator role</span>
                  <select
                    value={role}
                    onChange={(event) => {
                      setRole(event.target.value as AdministratorInviteRole);
                      setConfirmReduction(false);
                    }}
                  >
                    {ADMINISTRATOR_INVITE_ROLES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="admin-portal__muted">
                    {
                      ADMINISTRATOR_INVITE_ROLES.find((option) => option.value === role)
                        ?.description
                    }
                  </span>
                </label>
                <p className="admin-portal__muted">
                  Scope:{" "}
                  {scopeIsOrganization
                    ? "Entire organization"
                    : "Selected property/properties"}
                </p>
              </>
            )}
          </section>

          <section className="admin-portal__edit-section">
            <h4 className="admin-portal__edit-section-title">
              {scopeIsOrganization || isPrimary
                ? "Home property"
                : "Property assignments"}
            </h4>
            {isPrimary ? (
              <p className="admin-portal__muted">
                {properties.find((property) => property.id === invitation.propertyId)
                  ?.name ?? `Property #${invitation.propertyId}`}
              </p>
            ) : scopeIsOrganization ? (
              <label className="admin-portal__field">
                <span>Home property</span>
                <select
                  value={String(propertyIds[0] ?? invitation.propertyId)}
                  onChange={(event) =>
                    setPropertyIds([Number.parseInt(event.target.value, 10)])
                  }
                >
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="admin-portal__checkbox-grid">
                {properties.map((property) => (
                  <label key={property.id} className="admin-portal__checkbox-field">
                    <input
                      type="checkbox"
                      checked={propertyIds.includes(property.id)}
                      onChange={() => toggleProperty(property.id)}
                    />
                    <span>{property.name}</span>
                  </label>
                ))}
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
              />
              <span>
                I confirm this save reduces administrator access (role, property
                scope, and/or modules).
              </span>
            </label>
          ) : null}

          <div className="admin-portal__form-actions">
            <button
              type="button"
              className="admin-portal__button"
              onClick={onClose}
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
      </div>
    </div>
  );
}
