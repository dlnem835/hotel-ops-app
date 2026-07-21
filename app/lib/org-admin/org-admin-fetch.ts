"use client";

import { supabase } from "@/app/supabaseClient";

/**
 * Authenticated fetch for customer Organization Admin routes (`/api/org-admin/*`).
 * Attaches the current Supabase access token. Same token as the platform portal —
 * the server guard scopes access to the caller's own organization.
 */
export async function orgAdminFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(init.headers);

  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  return fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
