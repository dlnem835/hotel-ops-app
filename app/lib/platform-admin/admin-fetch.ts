"use client";

import { supabase } from "@/app/supabaseClient";

/**
 * Authenticated fetch for internal `/api/admin/*` routes.
 * Attaches the current Supabase access token only — no tenant property header.
 */
export async function adminFetch(
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
