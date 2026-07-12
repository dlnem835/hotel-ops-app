"use client";

import { supabase } from "@/app/supabaseClient";
import { readStoredActivePropertyId } from "@/app/lib/tenant/active-property-storage";
import { ONE_EYRIE_PROPERTY_HEADER } from "@/app/lib/tenant/server/tenant-headers";

/**
 * Drop-in replacement for `fetch` on internal `/api` calls that require tenant
 * context. Attaches the current Supabase access token and the active property id
 * so server routes can authenticate and scope the request.
 */
export async function tenantFetch(
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

  const propertyId = readStoredActivePropertyId();
  if (propertyId != null) {
    headers.set(ONE_EYRIE_PROPERTY_HEADER, String(propertyId));
  }

  return fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
