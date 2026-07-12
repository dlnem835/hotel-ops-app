import type { SupabaseClient } from "@supabase/supabase-js";
import { writeAdminAuditLog } from "@/app/lib/platform-admin/server/admin-audit-log";
import { resolveGmModulePermissions } from "@/app/lib/platform-admin/server/gm-module-permissions";
import { ORGANIZATION_STATUS_ACTIVE } from "@/app/lib/platform-admin/server/organization-constants";
import { PlatformAdminRequestError } from "@/app/lib/platform-admin/server/resolve-platform-admin-request";
import type { AdminOrganizationInvitation } from "@/app/lib/platform-admin/types";

export type CreateGmInvitationInput = {
  propertyId: number;
  email: string;
  firstName: string;
  lastName: string;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveInviteRedirectUrl(): string {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.SMOKE_BASE_URL ||
    "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/login`;
}

function parseCreateGmInvitationInput(
  body: Record<string, unknown>
): CreateGmInvitationInput {
  const propertyId = Number.parseInt(String(body.propertyId ?? ""), 10);
  const email = normalizeEmail(String(body.email ?? ""));
  const firstName = String(body.firstName ?? body.first_name ?? "").trim();
  const lastName = String(body.lastName ?? body.last_name ?? "").trim();

  if (!Number.isInteger(propertyId) || propertyId <= 0) {
    throw new PlatformAdminRequestError(400, "Property id is required");
  }
  if (!email || !isValidEmail(email)) {
    throw new PlatformAdminRequestError(400, "Valid email is required");
  }
  if (!firstName) {
    throw new PlatformAdminRequestError(400, "First name is required");
  }
  if (!lastName) {
    throw new PlatformAdminRequestError(400, "Last name is required");
  }

  return { propertyId, email, firstName, lastName };
}

export async function fetchOrganizationInvitations(
  supabase: SupabaseClient,
  organizationId: number
): Promise<AdminOrganizationInvitation[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select(
      "id, organization_id, property_id, email, first_name, last_name, status, created_at, accepted_at, properties(name)"
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((row) => {
    const property = row.properties as { name?: string } | null | undefined;
    return {
      id: String(row.id),
      organizationId: row.organization_id as number,
      propertyId: row.property_id as number,
      propertyName: property?.name ?? null,
      email: String(row.email),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      status: String(row.status),
      createdAt: String(row.created_at),
      acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
    };
  });
}

export function canInviteFirstGm(input: {
  organizationStatus: string;
  propertyCount: number;
  invitations: AdminOrganizationInvitation[];
}): boolean {
  if (input.organizationStatus !== ORGANIZATION_STATUS_ACTIVE) {
    return false;
  }
  if (input.propertyCount === 0) {
    return false;
  }

  return !input.invitations.some(
    (invitation) => invitation.status === "pending" || invitation.status === "accepted"
  );
}

export async function createGmInvitation(
  supabase: SupabaseClient,
  actorUserId: string,
  organizationId: number,
  body: Record<string, unknown>
): Promise<AdminOrganizationInvitation> {
  const input = parseCreateGmInvitationInput(body);

  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, status")
    .eq("id", organizationId)
    .maybeSingle();

  if (orgError) {
    throw new Error(orgError.message);
  }
  if (!organization) {
    throw new PlatformAdminRequestError(404, "Organization not found");
  }
  if (organization.status !== ORGANIZATION_STATUS_ACTIVE) {
    throw new PlatformAdminRequestError(
      409,
      "Invitations can only be sent for active organizations"
    );
  }

  const { data: property, error: propertyError } = await supabase
    .from("properties")
    .select("id, name, organization_id, active")
    .eq("id", input.propertyId)
    .maybeSingle();

  if (propertyError) {
    throw new Error(propertyError.message);
  }
  if (!property || property.organization_id !== organizationId) {
    throw new PlatformAdminRequestError(404, "Property not found for organization");
  }

  const { count: propertyCount, error: propertyCountError } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);

  if (propertyCountError) {
    throw new Error(propertyCountError.message);
  }

  const existingInvitations = await fetchOrganizationInvitations(supabase, organizationId);
  if (!canInviteFirstGm({
    organizationStatus: organization.status,
    propertyCount: propertyCount ?? 0,
    invitations: existingInvitations,
  })) {
    throw new PlatformAdminRequestError(
      409,
      "A pending or accepted GM invitation already exists for this organization"
    );
  }

  const { data: invitation, error: insertError } = await supabase
    .from("organization_invitations")
    .insert({
      organization_id: organizationId,
      property_id: input.propertyId,
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      org_role: "org_owner",
      property_role: "property_admin",
      job_title: "General Manager",
      status: "pending",
      invited_by: actorUserId,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      throw new PlatformAdminRequestError(
        409,
        "A pending invitation already exists for this email"
      );
    }
    throw new Error(insertError.message);
  }

  const invitationId = String(invitation.id);

  let authUserId: string | null = null;

  const { data: inviteData, error: inviteError } =
    await supabase.auth.admin.inviteUserByEmail(input.email, {
      redirectTo: resolveInviteRedirectUrl(),
      data: {
        oe_invitation_id: invitationId,
        first_name: input.firstName,
        last_name: input.lastName,
        job_title: "General Manager",
        is_administrator: true,
      },
    });

  if (inviteError) {
    const canFallback =
      inviteError.message.toLowerCase().includes("rate limit") ||
      inviteError.message.toLowerCase().includes("invalid");

    if (!canFallback) {
      await supabase.from("organization_invitations").delete().eq("id", invitationId);
      throw new PlatformAdminRequestError(
        502,
        `Supabase invitation failed: ${inviteError.message}`
      );
    }

    const { data: createdUser, error: createUserError } =
      await supabase.auth.admin.createUser({
        email: input.email,
        email_confirm: true,
        user_metadata: {
          oe_invitation_id: invitationId,
          first_name: input.firstName,
          last_name: input.lastName,
          job_title: "General Manager",
          is_administrator: true,
        },
      });

    if (createUserError) {
      await supabase.from("organization_invitations").delete().eq("id", invitationId);
      throw new PlatformAdminRequestError(
        502,
        `Supabase user provisioning failed: ${createUserError.message}`
      );
    }

    authUserId = createdUser.user?.id ?? null;
  } else {
    authUserId = inviteData.user?.id ?? null;
  }

  const { error: updateError } = await supabase
    .from("organization_invitations")
    .update({
      auth_user_id: authUserId,
      supabase_invite_id: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", invitationId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  await writeAdminAuditLog(supabase, {
    actorUserId,
    action: "invitation.created",
    targetType: "organization_invitation",
    targetId: invitationId,
    organizationId,
    propertyId: input.propertyId,
    metadata: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationName: organization.name,
      propertyName: property.name,
    },
  });

  const invitations = await fetchOrganizationInvitations(supabase, organizationId);
  const created = invitations.find((row) => row.id === invitationId);
  if (!created) {
    throw new Error("Created invitation could not be loaded");
  }

  return created;
}
