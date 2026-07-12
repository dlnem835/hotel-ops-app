import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminOrganizationDetail,
  AdminOrganizationLifecycle,
  PlatformAdminRecord,
} from "@/app/lib/platform-admin/types";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { fetchAdminOrganizationDetail } from "@/app/lib/platform-admin/server/admin-organizations";
import { evaluateOrganizationDeleteEligibility } from "@/app/lib/platform-admin/server/organization-delete-eligibility";
import {
  ORGANIZATION_STATUS_ACTIVE,
  ORGANIZATION_STATUS_SUSPENDED,
  PILOT_ORGANIZATION_ID,
} from "@/app/lib/platform-admin/server/organization-constants";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";

type OrganizationRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
};

async function loadOrganization(
  supabase: SupabaseClient,
  organizationId: number
): Promise<OrganizationRow> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }

  return data as OrganizationRow;
}

export async function buildOrganizationLifecycle(
  supabase: SupabaseClient,
  organization: Pick<OrganizationRow, "id" | "status">
): Promise<AdminOrganizationLifecycle> {
  const eligibility = await evaluateOrganizationDeleteEligibility(supabase, organization.id);

  return {
    canSuspend:
      organization.id !== PILOT_ORGANIZATION_ID &&
      organization.status === ORGANIZATION_STATUS_ACTIVE,
    canReactivate: organization.status === ORGANIZATION_STATUS_SUSPENDED,
    canDeleteTestOrganization:
      organization.id !== PILOT_ORGANIZATION_ID && eligibility.eligible,
    deleteBlockers: eligibility.blockers,
  };
}

export async function suspendAdminOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number
): Promise<AdminOrganizationDetail> {
  const organization = await loadOrganization(supabase, organizationId);

  if (organizationId === PILOT_ORGANIZATION_ID) {
    throw new PlatformAdminRequestError(409, "Pilot organization cannot be suspended");
  }

  if (organization.status === ORGANIZATION_STATUS_SUSPENDED) {
    throw new PlatformAdminRequestError(409, "Organization is already suspended");
  }

  if (organization.status !== ORGANIZATION_STATUS_ACTIVE) {
    throw new PlatformAdminRequestError(
      409,
      "Only active organizations can be suspended"
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      status: ORGANIZATION_STATUS_SUSPENDED,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "organization.suspended",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId,
    metadata: {
      previousStatus: organization.status,
      name: organization.name,
      slug: organization.slug,
    },
  });

  const detail = await fetchAdminOrganizationDetail(supabase, organizationId);
  if (!detail) {
    throw new Error("Suspended organization could not be loaded");
  }

  return detail;
}

export async function reactivateAdminOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number
): Promise<AdminOrganizationDetail> {
  const organization = await loadOrganization(supabase, organizationId);

  if (organization.status !== ORGANIZATION_STATUS_SUSPENDED) {
    throw new PlatformAdminRequestError(
      409,
      "Only suspended organizations can be reactivated"
    );
  }

  const { error } = await supabase
    .from("organizations")
    .update({
      status: ORGANIZATION_STATUS_ACTIVE,
      updated_at: new Date().toISOString(),
    })
    .eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "organization.reactivated",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId,
    metadata: {
      previousStatus: organization.status,
      name: organization.name,
      slug: organization.slug,
    },
  });

  const detail = await fetchAdminOrganizationDetail(supabase, organizationId);
  if (!detail) {
    throw new Error("Reactivated organization could not be loaded");
  }

  return detail;
}

export async function deleteTestAdminOrganization(
  supabase: SupabaseClient,
  actorUserId: string,
  platformAdmin: PlatformAdminRecord,
  organizationId: number,
  confirmName: string
): Promise<void> {
  if (platformAdmin.role !== "platform_owner") {
    throw new PlatformAdminRequestError(
      403,
      "Forbidden — platform owner access required"
    );
  }

  if (organizationId === PILOT_ORGANIZATION_ID) {
    throw new PlatformAdminRequestError(409, "Pilot organization cannot be deleted");
  }

  const organization = await loadOrganization(supabase, organizationId);
  const trimmedConfirmName = confirmName.trim();

  if (!trimmedConfirmName) {
    throw new PlatformAdminRequestError(400, "Organization name confirmation is required");
  }

  if (trimmedConfirmName !== organization.name) {
    throw new PlatformAdminRequestError(
      400,
      "Organization name confirmation does not match"
    );
  }

  const eligibility = await evaluateOrganizationDeleteEligibility(supabase, organizationId);
  if (!eligibility.eligible) {
    throw new PlatformAdminRequestError(
      409,
      `Organization cannot be deleted: ${eligibility.blockers.join(", ")}`
    );
  }

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "organization.deleted",
    targetType: "organization",
    targetId: String(organizationId),
    organizationId: null,
    metadata: {
      name: organization.name,
      slug: organization.slug,
      reason: "test_organization_cleanup",
    },
  });
}
