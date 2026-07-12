"use client";

import { FormEvent, useEffect, useState } from "react";
import { adminFetch } from "@/app/lib/platform-admin/admin-fetch";
import { MODULE_PERMISSION_LABELS, type ModulePermissionKey } from "@/app/lib/role-permissions";
import type { AdminOrganizationModule } from "@/app/lib/platform-admin/types";
import { ORGANIZATION_MODULE_KEYS } from "@/app/lib/platform-admin/organization-module-keys";

type AdminModuleControlsProps = {
  organizationId: number;
  modules: AdminOrganizationModule[];
  onModulesUpdated: (modules: AdminOrganizationModule[]) => void;
  onError: (message: string) => void;
};

function buildModuleState(modules: AdminOrganizationModule[]) {
  const state = {} as Record<ModulePermissionKey, boolean>;

  for (const moduleKey of ORGANIZATION_MODULE_KEYS) {
    const row = modules.find((module) => module.moduleKey === moduleKey);
    state[moduleKey] = row?.enabled ?? false;
  }

  return state;
}

export default function AdminModuleControls({
  organizationId,
  modules,
  onModulesUpdated,
  onError,
}: AdminModuleControlsProps) {
  const [moduleState, setModuleState] = useState(() => buildModuleState(modules));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setModuleState(buildModuleState(modules));
  }, [modules]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    onError("");

    const payload = {
      modules: ORGANIZATION_MODULE_KEYS.map((moduleKey) => ({
        moduleKey,
        enabled: moduleState[moduleKey],
      })),
    };

    const response = await adminFetch(`/api/admin/organizations/${organizationId}/modules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      onError(body?.error ?? `Module update failed (${response.status})`);
      setSubmitting(false);
      return;
    }

    const body = (await response.json()) as { modules: AdminOrganizationModule[] };
    onModulesUpdated(body.modules ?? []);
    setSubmitting(false);
  }

  return (
    <section className="admin-portal__card">
      <h3 className="admin-portal__section-title">Module controls</h3>
      <p className="admin-portal__muted">
        Org-level entitlements for subscription licensing. Disabling a module removes it from
        stored hotel user permissions in this organization.
      </p>

      <form className="admin-portal__form" onSubmit={handleSubmit}>
        <div className="admin-portal__module-grid">
          {ORGANIZATION_MODULE_KEYS.map((moduleKey) => (
            <label key={moduleKey} className="admin-portal__checkbox-field">
              <input
                type="checkbox"
                checked={moduleState[moduleKey]}
                onChange={(event) =>
                  setModuleState((current) => ({
                    ...current,
                    [moduleKey]: event.target.checked,
                  }))
                }
              />
              <span>{MODULE_PERMISSION_LABELS[moduleKey]}</span>
            </label>
          ))}
        </div>

        <div className="admin-portal__form-actions">
          <button
            type="submit"
            className="admin-portal__button admin-portal__button--primary"
            disabled={submitting}
          >
            {submitting ? "Saving modules…" : "Save module controls"}
          </button>
        </div>
      </form>
    </section>
  );
}
