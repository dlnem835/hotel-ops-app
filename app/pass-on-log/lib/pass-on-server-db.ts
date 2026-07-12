import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type PassOnScope = {
  organizationId: number;
  propertyId: number;
};

const ENTRY_SELECT = "*, pass_on_log_replies(*), pass_on_log_views(*)";

/** Verifies a pass-on entry belongs to the active tenant, else throws 404. */
async function assertEntryInTenant(
  supabase: SupabaseClient,
  entryId: number,
  scope: PassOnScope
): Promise<void> {
  const { data, error } = await supabase
    .from("pass_on_log")
    .select("id")
    .eq("id", entryId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "Pass-on entry not found");
}

async function assertReplyInTenant(
  supabase: SupabaseClient,
  replyId: number,
  scope: PassOnScope
): Promise<void> {
  const { data, error } = await supabase
    .from("pass_on_log_replies")
    .select("id")
    .eq("id", replyId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TenantRequestError(404, "Pass-on reply not found");
}

export async function listPassOnEntries(supabase: SupabaseClient, scope: PassOnScope) {
  const { data, error } = await supabase
    .from("pass_on_log")
    .select(ENTRY_SELECT)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPassOnEntry(
  supabase: SupabaseClient,
  id: number,
  scope: PassOnScope
) {
  const { data, error } = await supabase
    .from("pass_on_log")
    .select(ENTRY_SELECT)
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function createPassOnEntry(
  supabase: SupabaseClient,
  scope: PassOnScope,
  input: {
    subject: string;
    author: string;
    priority: string;
    message: string;
    created_at: string;
    entry_date: string;
  }
) {
  const { data, error } = await supabase
    .from("pass_on_log")
    .insert([
      {
        subject: input.subject,
        author: input.author,
        priority: input.priority,
        message: input.message,
        created_at: input.created_at,
        entry_date: input.entry_date,
        organization_id: scope.organizationId,
        property_id: scope.propertyId,
      },
    ])
    .select(ENTRY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePassOnEntry(
  supabase: SupabaseClient,
  id: number,
  scope: PassOnScope,
  patch: { message: string; edited_at: string }
) {
  await assertEntryInTenant(supabase, id, scope);
  const { data, error } = await supabase
    .from("pass_on_log")
    .update({ message: patch.message, edited_at: patch.edited_at })
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .select(ENTRY_SELECT)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePassOnEntry(
  supabase: SupabaseClient,
  id: number,
  scope: PassOnScope
) {
  await assertEntryInTenant(supabase, id, scope);
  const { error } = await supabase
    .from("pass_on_log")
    .delete()
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);
  if (error) throw new Error(error.message);
}

export async function addPassOnReply(
  supabase: SupabaseClient,
  scope: PassOnScope,
  entryId: number,
  input: { reply_author: string; reply_message: string }
) {
  await assertEntryInTenant(supabase, entryId, scope);
  const { data, error } = await supabase
    .from("pass_on_log_replies")
    .insert([
      {
        entry_id: entryId,
        reply_author: input.reply_author,
        reply_message: input.reply_message,
      },
    ])
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function updatePassOnReply(
  supabase: SupabaseClient,
  replyId: number,
  scope: PassOnScope,
  patch: { reply_message: string; edited_at: string }
) {
  await assertReplyInTenant(supabase, replyId, scope);
  const { data, error } = await supabase
    .from("pass_on_log_replies")
    .update({ reply_message: patch.reply_message, edited_at: patch.edited_at })
    .eq("id", replyId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function deletePassOnReply(
  supabase: SupabaseClient,
  replyId: number,
  scope: PassOnScope
) {
  await assertReplyInTenant(supabase, replyId, scope);
  const { error, count } = await supabase
    .from("pass_on_log_replies")
    .delete({ count: "exact" })
    .eq("id", replyId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markPassOnViewed(
  supabase: SupabaseClient,
  scope: PassOnScope,
  entryId: number,
  authUserId: string
) {
  await assertEntryInTenant(supabase, entryId, scope);
  const { error } = await supabase.from("pass_on_log_views").upsert(
    {
      entry_id: entryId,
      auth_user_id: authUserId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "entry_id,auth_user_id" }
  );
  if (error) throw new Error(error.message);
}
