import type { SupabaseClient } from "@supabase/supabase-js";

const SLUG_MAX_LENGTH = 64;

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX_LENGTH);

  return slug || "organization";
}

export function isValidOrganizationSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= SLUG_MAX_LENGTH;
}

export async function ensureUniqueOrganizationSlug(
  supabase: SupabaseClient,
  baseSlug: string
): Promise<string> {
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return candidate;
    }

    const trimmedBase = baseSlug.slice(0, Math.max(1, SLUG_MAX_LENGTH - String(suffix).length - 1));
    candidate = `${trimmedBase}-${suffix}`;
    suffix += 1;
  }
}
