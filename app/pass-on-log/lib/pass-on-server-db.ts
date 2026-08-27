import type { SupabaseClient } from "@supabase/supabase-js";
import { TenantRequestError } from "@/app/lib/tenant/server/resolve-tenant-request";

export type PassOnScope = {
  organizationId: number;
  propertyId: number;
};

const ENTRY_SELECT =
  "*, pass_on_log_replies(*), pass_on_log_views(*), pass_on_log_attachments(id, entry_id, reply_id, original_filename, content_type, byte_size, created_at)";

/** Verifies a pass-on entry belongs to the active tenant, else throws 404. */
export async function assertEntryInTenant(
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

export async function assertReplyInTenant(
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

/**
 * Resolves the user's Pass-On read baseline for the active property.
 *
 * Priority:
 * 1) user_properties.pass_on_read_baseline when set (new memberships via 044 trigger)
 * 2) NULL user_properties baseline → legacy membership, no cutoff (unchanged)
 * 3) No user_properties row (org-wide access) → first-access stamp in
 *    pass_on_access_baselines, unless the user already has Pass-On views at this
 *    property (existing org-wide usage → no cutoff)
 */
export async function getPassOnReadBaseline(
  supabase: SupabaseClient,
  userId: string,
  propertyId: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_properties")
    .select("pass_on_read_baseline")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();
  if (error) {
    // Tolerate environments where migration 044 has not been applied yet
    // (missing column/table): fall back to legacy unread behavior.
    if (
      error.code === "42703" ||
      error.code === "42P01" ||
      /does not exist/i.test(error.message)
    ) {
      return null;
    }
    throw new Error(error.message);
  }

  if (data) {
    // Explicit membership row: non-null baseline from INSERT trigger, or NULL
    // legacy membership that must keep historical unread behavior.
    return (data.pass_on_read_baseline as string | null | undefined) ?? null;
  }

  return ensurePassOnAccessBaseline(supabase, userId, propertyId);
}

/**
 * First sign-in / first access baseline for users who reach a property without
 * a user_properties row (org-wide roles). Never overwrites an existing stamp.
 * Never stamps users who already have Pass-On views at this property.
 */
async function ensurePassOnAccessBaseline(
  supabase: SupabaseClient,
  userId: string,
  propertyId: number
): Promise<string | null> {
  const { data: existing, error: existingError } = await supabase
    .from("pass_on_access_baselines")
    .select("baseline_at")
    .eq("user_id", userId)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existingError) {
    if (
      existingError.code === "42P01" ||
      existingError.code === "42703" ||
      /does not exist/i.test(existingError.message)
    ) {
      return null;
    }
    throw new Error(existingError.message);
  }

  if (existing?.baseline_at) {
    return String(existing.baseline_at);
  }

  // Existing org-wide users who already engaged Pass-On here: no cutoff.
  const { count, error: viewsError } = await supabase
    .from("pass_on_log_views")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", userId)
    .eq("property_id", propertyId);

  if (viewsError) {
    console.error("[pass-on-baseline] views check failed", viewsError.message);
  } else if ((count ?? 0) > 0) {
    return null;
  }

  const baselineAt = new Date().toISOString();
  const { data: inserted, error: insertError } = await supabase
    .from("pass_on_access_baselines")
    .upsert(
      {
        user_id: userId,
        property_id: propertyId,
        baseline_at: baselineAt,
      },
      { onConflict: "user_id,property_id", ignoreDuplicates: true }
    )
    .select("baseline_at")
    .maybeSingle();

  if (insertError) {
    if (
      insertError.code === "42P01" ||
      insertError.code === "42703" ||
      /does not exist/i.test(insertError.message)
    ) {
      return null;
    }
    // Race: another request inserted first — re-read.
    const { data: raced } = await supabase
      .from("pass_on_access_baselines")
      .select("baseline_at")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .maybeSingle();
    return raced?.baseline_at ? String(raced.baseline_at) : null;
  }

  return inserted?.baseline_at
    ? String(inserted.baseline_at)
    : baselineAt;
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
  const { data: attachments, error: attachmentsError } = await supabase
    .from("pass_on_log_attachments")
    .select("storage_path")
    .eq("entry_id", id)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);
  if (attachmentsError) throw new Error(attachmentsError.message);

  const storagePaths = (attachments || []).map((attachment) =>
    String(attachment.storage_path)
  );
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("pass-on-attachments")
      .remove(storagePaths);
    if (storageError) throw new Error(storageError.message);
  }

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
  const { data: attachments, error: attachmentsError } = await supabase
    .from("pass_on_log_attachments")
    .select("storage_path")
    .eq("reply_id", replyId)
    .eq("organization_id", scope.organizationId)
    .eq("property_id", scope.propertyId);
  if (attachmentsError) throw new Error(attachmentsError.message);

  const storagePaths = (attachments || []).map((attachment) =>
    String(attachment.storage_path)
  );
  if (storagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from("pass-on-attachments")
      .remove(storagePaths);
    if (storageError) throw new Error(storageError.message);
  }

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
