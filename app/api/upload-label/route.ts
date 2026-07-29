import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/app/settings/lib/hotel-property-db";

// PUBLIC guest-facing route: guests arrive via the emailed /label?id= link without
// authenticating. Storage writes use the anon key with tenant-namespaced paths
// enforced by migration 036 storage policies. Item lookup/update uses service role
// because lost_items RLS requires membership (Checkpoint 5).
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  const formData = await request.formData();

  const file = formData.get("file") as File;
  const itemId = formData.get("itemId") as string;

  if (!file || !itemId) {
    return Response.json({ error: "Missing file or item ID" }, { status: 400 });
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: item, error: itemError } = await supabaseAdmin
    .from("lost_items")
    .select("id, organization_id, property_id")
    .eq("id", itemId)
    .maybeSingle();

  if (itemError) {
    return Response.json({ error: itemError.message }, { status: 500 });
  }
  if (!item) {
    return Response.json({ error: "Item not found" }, { status: 404 });
  }

  const tenantPrefix =
    item.organization_id != null && item.property_id != null
      ? `org-${item.organization_id}/property-${item.property_id}/`
      : "";
  const filePath = `${tenantPrefix}${itemId}-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabaseAnon.storage
    .from("shipping-labels")
    .upload(filePath, file);

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabaseAnon.storage
    .from("shipping-labels")
    .getPublicUrl(filePath);

  const { error: updateError } = await supabaseAdmin
    .from("lost_items")
    .update({
      label_url: data.publicUrl,
      status: "Ready to Ship",
    })
    .eq("id", item.id)
    .eq("organization_id", item.organization_id)
    .eq("property_id", item.property_id);

  if (updateError) {
    return Response.json({ error: updateError.message }, { status: 500 });
  }

  return Response.json({ success: true, labelUrl: data.publicUrl });
}
