import { createClient } from "@supabase/supabase-js";

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

  const filePath = `${itemId}-${Date.now()}-${file.name}`;

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