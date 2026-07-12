import { SupabaseClient } from "@supabase/supabase-js";
import {
  getAdministratorPermissions,
  normalizeModulePermissions,
} from "@/app/lib/role-permissions";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type TeamTenantScope = {
  organizationId: number;
  propertyId: number;
};

type TeamMemberRow = Record<string, unknown>;

export type TeamMemberInput = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  department?: string | null;
  job_title: string;
  is_administrator: boolean;
  module_permissions: Record<string, boolean>;
  status: string;
  can_login: boolean;
  username: string;
  tempPassword: string;
};

function resolveStoredPermissions(
  isAdministrator: boolean,
  modulePermissions: Record<string, boolean>
) {
  if (isAdministrator) {
    return getAdministratorPermissions();
  }
  return normalizeModulePermissions(modulePermissions);
}

export function resolveOrgMembershipRole(isAdministrator: boolean) {
  return isAdministrator ? "org_admin" : "org_member";
}

export function resolvePropertyMembershipRole(isAdministrator: boolean) {
  return isAdministrator ? "property_admin" : "property_staff";
}

export async function assertTeamMemberInTenant(
  supabase: SupabaseClient,
  teamMemberId: string,
  scope: TeamTenantScope
) {
  const { data, error } = await supabase
    .from("team_members")
    .select("id")
    .eq("id", teamMemberId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new TenantRequestError(404, "Team member not found");
  }
}

export async function assertCanManageTeamMembers(
  supabase: SupabaseClient,
  authUserId: string,
  scope: TeamTenantScope
) {
  const { data, error } = await supabase
    .from("team_members")
    .select("is_administrator, module_permissions, job_title")
    .eq("auth_user_id", authUserId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new TenantRequestError(403, "Team member profile not found");
  }

  const permissions = data.module_permissions as Record<string, boolean> | null;
  const jobTitle = String(data.job_title || "").trim();
  const canManage =
    Boolean(data.is_administrator) ||
    Boolean(permissions?.settings) ||
    jobTitle === "General Manager" ||
    jobTitle === "Assistant General Manager";

  if (!canManage) {
    throw new TenantRequestError(
      403,
      "You do not have permission to manage team members"
    );
  }
}

export async function fetchTeamMembersForTenant(
  supabase: SupabaseClient,
  scope: TeamTenantScope
) {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function syncUserMemberships(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    organizationId: number;
    propertyId: number;
    isAdministrator: boolean;
    modulePermissions: Record<string, boolean>;
    active?: boolean;
  }
) {
  const {
    authUserId,
    organizationId,
    propertyId,
    isAdministrator,
    modulePermissions,
  } = params;
  const active = params.active ?? true;

  const { error: orgError } = await supabase.from("organization_users").upsert(
    {
      organization_id: organizationId,
      user_id: authUserId,
      role: resolveOrgMembershipRole(isAdministrator),
      active,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" }
  );

  if (orgError) {
    throw new Error(orgError.message);
  }

  const { error: propertyError } = await supabase.from("user_properties").upsert(
    {
      user_id: authUserId,
      property_id: propertyId,
      role: resolvePropertyMembershipRole(isAdministrator),
      is_default: true,
      active,
      module_permissions: modulePermissions,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,property_id" }
  );

  if (propertyError) {
    throw new Error(propertyError.message);
  }
}

async function createAuthUser(
  supabase: SupabaseClient,
  input: {
    username: string;
    tempPassword: string;
    first_name: string;
    last_name: string;
    job_title: string;
    is_administrator: boolean;
  }
) {
  const authEmail = `${input.username}@oneeyrie.local`;
  const { data, error } = await supabase.auth.admin.createUser({
    email: authEmail,
    password: input.tempPassword,
    email_confirm: true,
    user_metadata: {
      first_name: input.first_name,
      last_name: input.last_name,
      job_title: input.job_title,
      is_administrator: input.is_administrator,
      username: input.username,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    authUserId: data.user.id,
    authEmail,
  };
}

async function updateAuthUser(
  supabase: SupabaseClient,
  authUserId: string,
  input: {
    username: string;
    tempPassword?: string;
    first_name: string;
    last_name: string;
    job_title: string;
    is_administrator: boolean;
  }
) {
  const authUpdates: {
    password?: string;
    email?: string;
    user_metadata: Record<string, string | boolean>;
  } = {
    user_metadata: {
      first_name: input.first_name,
      last_name: input.last_name,
      job_title: input.job_title,
      is_administrator: input.is_administrator,
      username: input.username,
    },
  };

  if (input.tempPassword) {
    authUpdates.password = input.tempPassword;
  }
  if (input.username) {
    authUpdates.email = `${input.username}@oneeyrie.local`;
  }

  const { error } = await supabase.auth.admin.updateUserById(
    authUserId,
    authUpdates
  );

  if (error) {
    throw new Error(error.message);
  }

  return input.username ? `${input.username}@oneeyrie.local` : null;
}

export async function createTeamMember(
  supabase: SupabaseClient,
  scope: TeamTenantScope,
  input: TeamMemberInput
) {
  const jobTitle = String(input.job_title || "").trim();
  const isAdministrator = Boolean(input.is_administrator);
  const permissions = resolveStoredPermissions(
    isAdministrator,
    input.module_permissions
  );

  let authUserId: string | null = null;
  let authEmail: string | null = null;

  if (input.can_login && input.username && input.tempPassword) {
    const auth = await createAuthUser(supabase, {
      username: input.username,
      tempPassword: input.tempPassword,
      first_name: input.first_name,
      last_name: input.last_name,
      job_title: jobTitle,
      is_administrator: isAdministrator,
    });
    authUserId = auth.authUserId;
    authEmail = auth.authEmail;
  }

  const { data, error } = await supabase
    .from("team_members")
    .insert([
      {
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email,
        phone: input.phone,
        department: input.department ?? null,
        job_title: jobTitle || null,
        role: jobTitle || null,
        is_administrator: isAdministrator,
        module_permissions: permissions,
        status: input.status,
        can_login: input.can_login,
        username: input.username || null,
        auth_email: authEmail,
        auth_user_id: authUserId,
        organization_id: scope.organizationId,
        property_id: scope.propertyId,
        default_property_id: scope.propertyId,
      },
    ])
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (authUserId) {
    await syncUserMemberships(supabase, {
      authUserId,
      organizationId: scope.organizationId,
      propertyId: scope.propertyId,
      isAdministrator,
      modulePermissions: permissions,
      active: input.status === "Active",
    });
  }

  return data as TeamMemberRow;
}

export async function updateTeamMember(
  supabase: SupabaseClient,
  scope: TeamTenantScope,
  teamMemberId: string,
  input: TeamMemberInput
) {
  await assertTeamMemberInTenant(supabase, teamMemberId, scope);

  const { data: existing, error: fetchError } = await supabase
    .from("team_members")
    .select("*")
    .eq("id", teamMemberId)
    .single();

  if (fetchError || !existing) {
    throw new TenantRequestError(404, "Team member not found");
  }

  const jobTitle = String(input.job_title || "").trim();
  const isAdministrator = Boolean(input.is_administrator);
  const permissions = resolveStoredPermissions(
    isAdministrator,
    input.module_permissions
  );

  let authUserId = existing.auth_user_id as string | null;
  let authEmail = existing.auth_email as string | null;

  if (input.can_login && input.username) {
    if (!authUserId && input.tempPassword) {
      const auth = await createAuthUser(supabase, {
        username: input.username,
        tempPassword: input.tempPassword,
        first_name: input.first_name,
        last_name: input.last_name,
        job_title: jobTitle,
        is_administrator: isAdministrator,
      });
      authUserId = auth.authUserId;
      authEmail = auth.authEmail;
    } else if (authUserId) {
      const updatedEmail = await updateAuthUser(supabase, authUserId, {
        username: input.username,
        tempPassword: input.tempPassword || undefined,
        first_name: input.first_name,
        last_name: input.last_name,
        job_title: jobTitle,
        is_administrator: isAdministrator,
      });
      if (updatedEmail) {
        authEmail = updatedEmail;
      }
    }
  }

  const { data, error } = await supabase
    .from("team_members")
    .update({
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email,
      phone: input.phone,
      ...(input.department !== undefined
        ? { department: input.department ?? null }
        : {}),
      job_title: jobTitle || null,
      role: jobTitle || null,
      is_administrator: isAdministrator,
      module_permissions: permissions,
      status: input.status,
      can_login: input.can_login,
      username:
        input.can_login && input.username ? input.username : existing.username,
      auth_email: authEmail ?? existing.auth_email,
      auth_user_id: authUserId ?? existing.auth_user_id,
      organization_id: scope.organizationId,
      property_id: scope.propertyId,
      default_property_id: scope.propertyId,
    })
    .eq("id", teamMemberId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (authUserId) {
    await syncUserMemberships(supabase, {
      authUserId,
      organizationId: scope.organizationId,
      propertyId: scope.propertyId,
      isAdministrator,
      modulePermissions: permissions,
      active: input.status === "Active",
    });
  }

  return data as TeamMemberRow;
}
