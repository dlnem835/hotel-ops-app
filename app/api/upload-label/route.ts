import { createClient } from "@supabase/supabase-js";

// PUBLIC guest-facing route: the guest is NOT authenticated here (they arrive via
// the emailed /label?id= link). It intentionally stays unauthenticated. The write
// is bounded to a single known item id and is namespaced to that item's tenant.
// A public-scoped RLS policy for this flow is deferred to Checkpoint 5.
const supabase = createClient(
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

  const { data: item, error: itemError } = await supabase
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

  const { error: uploadError } = await supabase.storage
    .from("shipping-labels")
    .upload(filePath, file);

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 });
  }

  const { data } = supabase.storage
    .from("shipping-labels")
    .getPublicUrl(filePath);

  await supabase
    .from("lost_items")
    .update({
      label_url: data.publicUrl,
      status: "Ready to be shipped",
    })
    .eq("id", itemId);

  return Response.json({ success: true, labelUrl: data.publicUrl });
}
