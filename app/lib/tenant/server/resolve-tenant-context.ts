import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type {
  TenantActiveProperty,
  TenantContextResponse,
  TenantOrganizationSummary,
  TenantPropertySummary,
} from "@/app/lib/tenant/types";
import { isOrgWideRole, PROPERTY_ROLE } from "@/app/lib/platform-admin/roles";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Missing Supabase server configuration");
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

type OrganizationUserRow = {
  organization_id: number;
  role: string;
  active: boolean;
  organizations: {
    id: number;
    name: string;
    slug: string;
    status: string;
  } | null;
};

type UserPropertyRow = {
  property_id: number;
  role: string;
  is_default: boolean;
  active: boolean;
  properties: {
    id: number;
    name: string;
    brand: string | null;
    timezone: string;
    active: boolean;
    organization_id: number;
  } | null;
};

function mapProperty(row: UserPropertyRow): TenantPropertySummary | null {
  const property = row.properties;
  if (!property || !property.active) {
    return null;
  }

  return {
    id: property.id,
    name: property.name,
    brand: property.brand,
    timezone: property.timezone,
    organizationId: property.organization_id,
    role: row.role,
    isDefault: row.is_default,
  };
}

function resolveActiveProperty(
  properties: TenantPropertySummary[],
  requestedPropertyId: number | null
): TenantActiveProperty | null {
  if (properties.length === 0) {
    return null;
  }

  const byId = requestedPropertyId
    ? properties.find((property) => property.id === requestedPropertyId)
    : null;
  const defaultProperty = properties.find((property) => property.isDefault);
  const selected = byId ?? defaultProperty ?? properties[0];

  return {
    id: selected.id,
    name: selected.name,
    brand: selected.brand,
    timezone: selected.timezone,
    organizationId: selected.organizationId,
    role: selected.role,
  };
}

export async function resolveTenantContextForUser(
  user: User,
  requestedPropertyId: number | null
): Promise<TenantContextResponse | null> {
  const supabase = getSupabaseAdmin();

  const { data: orgRows, error: orgError } = await supabase
    .from("organization_users")
    .select(
      "organization_id, role, active, organizations!inner(id, name, slug, status)"
    )
    .eq("user_id", user.id)
    .eq("active", true);

  if (orgError) {
    throw new Error(orgError.message);
  }

  const organizationUsers = (orgRows ?? []) as unknown as OrganizationUserRow[];
  if (organizationUsers.length === 0) {
    return null;
  }

  const authorizedOrgIds = new Set(
    organizationUsers
      .map((row) => row.organizations?.id ?? row.organization_id)
      .filter((id): id is number => typeof id === "number")
  );

  // Org-wide roles (Primary Owner / Organization Admin) administer EVERY active
  // property in their organization — including properties added later — without
  // needing an explicit user_properties row per property. Property-scoped
  // members (org_member) still only reach their explicit user_properties rows.
  const orgWideOrgIds = new Set(
    organizationUsers
      .filter((row) => isOrgWideRole(row.role))
      .map((row) => row.organizations?.id ?? row.organization_id)
      .filter((id): id is number => typeof id === "number")
  );

  const { data: propertyRows, error: propertyError } = await supabase
    .from("user_properties")
    .select(
      "property_id, role, is_default, active, properties!inner(id, name, brand, timezone, active, organization_id)"
    )
    .eq("user_id", user.id)
    .eq("active", true);

  if (propertyError) {
    throw new Error(propertyError.message);
  }

  const properties = ((propertyRows ?? []) as unknown as UserPropertyRow[])
    .map(mapProperty)
    .filter((property): property is TenantPropertySummary => property !== null)
    .filter((property) => authorizedOrgIds.has(property.organizationId));

  if (orgWideOrgIds.size > 0) {
    const { data: orgPropertyRows, error: orgPropertyError } = await supabase
      .from("properties")
      .select("id, name, brand, timezone, active, organization_id")
      .in("organization_id", Array.from(orgWideOrgIds))
      .eq("active", true);

    if (orgPropertyError) {
      throw new Error(orgPropertyError.message);
    }

    const seenPropertyIds = new Set(properties.map((property) => property.id));
    for (const row of orgPropertyRows ?? []) {
      if (seenPropertyIds.has(row.id)) {
        continue;
      }
      seenPropertyIds.add(row.id);
      properties.push({
        id: row.id,
        name: row.name,
        brand: row.brand,
        timezone: row.timezone,
        organizationId: row.organization_id,
        role: PROPERTY_ROLE.propertyAdministrator,
        isDefault: false,
      });
    }
  }

  properties.sort((a, b) => a.name.localeCompare(b.name));

  const activeProperty = resolveActiveProperty(properties, requestedPropertyId);
  if (!activeProperty) {
    return null;
  }

  const organizationUser =
    organizationUsers.find(
      (row) =>
        (row.organizations?.id ?? row.organization_id) === activeProperty.organizationId
    ) ?? organizationUsers[0];

  const organizationRecord = organizationUser.organizations;
  if (!organizationRecord) {
    return null;
  }

  const organization: TenantOrganizationSummary = {
    id: organizationRecord.id,
    name: organizationRecord.name,
    slug: organizationRecord.slug,
    role: organizationUser.role,
  };

  return {
    organization,
    properties,
    activeProperty,
  };
}
