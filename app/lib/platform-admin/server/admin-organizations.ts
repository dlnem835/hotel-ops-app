import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminDashboardResponse,
  AdminOrganizationDetail,
  AdminOrganizationSummary,
  AdminPropertyDetail,
  AdminPropertySummary,
} from "@/app/lib/platform-admin/types";
import { invitationBelongsOnPropertyPage } from "@/app/lib/platform-admin/roles";
import {
  buildOrganizationOnboarding,
  formatOnboardingSummary,
} from "@/app/lib/platform-admin/server/onboarding-status";
import { buildOrganizationLifecycle } from "@/app/lib/platform-admin/server/organization-lifecycle";
import {
  canInviteAdministrator,
  fetchOrganizationInvitations,
} from "@/app/lib/platform-admin/server/create-gm-invitation";
import { ORGANIZATION_STATUS_ACTIVE } from "@/app/lib/platform-admin/server/organization-constants";

type OrganizationRow = {
  id: number;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type OrganizationProfileRow = OrganizationRow & {
  legal_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  business_address: string | null;
  contact_name: string | null;
};

const ORGANIZATION_DETAIL_COLUMNS =
  "id, name, slug, status, created_at, updated_at, legal_name, contact_email, contact_phone, business_address, contact_name";

type PropertyRow = {
  id: number;
  organization_id: number;
  name: string;
  brand: string | null;
  address: string;
  phone_number: string;
  timezone: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

function mapOrganizationSummary(
  org: OrganizationRow,
  propertyCount: number
): AdminOrganizationSummary {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    propertyCount,
    createdAt: org.created_at,
    updatedAt: org.updated_at,
  };
}

function mapPropertySummary(property: PropertyRow): AdminPropertySummary {
  return {
    id: property.id,
    organizationId: property.organization_id,
    name: property.name,
    brand: property.brand,
    address: property.address,
    phoneNumber: property.phone_number,
    timezone: property.timezone,
    active: property.active,
    createdAt: property.created_at,
    updatedAt: property.updated_at,
  };
}

function mapPropertyDetail(property: PropertyRow): AdminPropertyDetail {
  return {
    ...mapPropertySummary(property),
    organizationName: null,
  };
}

export async function fetchAdminOrganizations(
  supabase: SupabaseClient
): Promise<AdminOrganizationSummary[]> {
  const { data: organizations, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (orgError) {
    throw new Error(orgError.message);
  }

  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select("id, organization_id");

  if (propertyError) {
    throw new Error(propertyError.message);
  }

  const counts = new Map<number, number>();
  for (const property of properties ?? []) {
    counts.set(property.organization_id, (counts.get(property.organization_id) ?? 0) + 1);
  }

  return (organizations ?? []).map((org) =>
    mapOrganizationSummary(org as OrganizationRow, counts.get(org.id) ?? 0)
  );
}

export async function fetchAdminDashboard(
  supabase: SupabaseClient
): Promise<AdminDashboardResponse> {
  const organizations = await fetchAdminOrganizations(supabase);

  const { count: propertyCount, error: propertyCountError } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true });

  if (propertyCountError) {
    throw new Error(propertyCountError.message);
  }

  return {
    organizationCount: organizations.length,
    propertyCount: propertyCount ?? 0,
    activeOrganizationCount: organizations.filter((org) => org.status === "active").length,
    organizations,
  };
}

export async function fetchAdminOrganizationDetail(
  supabase: SupabaseClient,
  organizationId: number
): Promise<AdminOrganizationDetail | null> {
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(ORGANIZATION_DETAIL_COLUMNS)
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }
  if (!organization) {
    return null;
  }

  const { data: properties, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, organization_id, name, brand, address, phone_number, timezone, active, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .order("id", { ascending: true });

  if (propertyError) {
    throw new Error(propertyError.message);
  }

  const propertyRows = (properties ?? []) as PropertyRow[];
  const propertyIds = propertyRows.map((property) => property.id);

  const { data: modules, error: moduleError } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", organizationId)
    .order("module_key", { ascending: true });

  if (moduleError) {
    throw new Error(moduleError.message);
  }

  const { count: pendingInvitations, error: invitationError } = await supabase
    .from("organization_invitations")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending");

  if (invitationError) {
    throw new Error(invitationError.message);
  }

  const onboarding = await buildOrganizationOnboarding(
    supabase,
    organizationId,
    propertyIds
  );

  const orgRow = organization as OrganizationProfileRow;
  const lifecycle = await buildOrganizationLifecycle(supabase, orgRow);
  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const canInviteAdmin = canInviteAdministrator({
    organizationStatus: orgRow.status,
    propertyCount: propertyRows.length,
  });

  return {
    ...mapOrganizationSummary(orgRow, propertyRows.length),
    legalName: orgRow.legal_name ?? null,
    contactEmail: orgRow.contact_email ?? null,
    contactPhone: orgRow.contact_phone ?? null,
    businessAddress: orgRow.business_address ?? null,
    contactName: orgRow.contact_name ?? null,
    properties: propertyRows.map(mapPropertySummary),
    modules: (modules ?? []).map((row) => ({
      moduleKey: String(row.module_key),
      enabled: Boolean(row.enabled),
    })),
    onboarding,
    onboardingLabel: formatOnboardingSummary(onboarding),
    pendingInvitations: pendingInvitations ?? 0,
    lifecycle,
    invitations,
    canInviteAdministrator: canInviteAdmin,
  };
}

export async function fetchAdminPropertyDetail(
  supabase: SupabaseClient,
  propertyId: number
): Promise<AdminPropertyDetail | null> {
  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select(
      "id, organization_id, name, brand, address, phone_number, timezone, active, created_at, updated_at"
    )
    .eq("id", propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (!property) {
    return null;
  }

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("name, slug, status")
    .eq("id", property.organization_id)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }

  const detail = mapPropertyDetail(property as PropertyRow);
  detail.organizationName = organization?.name ?? null;
  detail.organizationSlug = organization?.slug ?? null;
  detail.organizationStatus = organization?.status ?? null;

  const onboarding = await buildOrganizationOnboarding(supabase, property.organization_id, [
    property.id,
  ]);
  detail.onboarding = onboarding;
  detail.onboardingLabel = formatOnboardingSummary(onboarding);

  const { count: areaCount, error: areaError } = await supabase
    .from("buildings_and_areas")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId);

  if (areaError) {
    throw new Error(areaError.message);
  }

  detail.areaCount = areaCount ?? 0;

  const allInvitations = await fetchOrganizationInvitations(
    supabase,
    property.organization_id
  );
  detail.invitations = allInvitations.filter((invitation) =>
    invitationBelongsOnPropertyPage(invitation, propertyId)
  );

  const { data: modules, error: modulesError } = await supabase
    .from("organization_modules")
    .select("module_key, enabled")
    .eq("organization_id", property.organization_id);

  if (modulesError) {
    throw new Error(modulesError.message);
  }
  detail.modules = (modules ?? []).map((row) => ({
    moduleKey: String(row.module_key),
    enabled: Boolean(row.enabled),
  }));
  detail.canInviteAdministrator =
    organization?.status === ORGANIZATION_STATUS_ACTIVE && Boolean(property.active);

  return detail;
}
