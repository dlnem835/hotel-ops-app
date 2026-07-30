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

/**
 * Parse a tenant API response as JSON. Surfaces a clear message when the server
 * returns an HTML page (auth redirect, Next error page, etc.) instead of JSON.
 */
export async function readTenantJson<T = unknown>(
  response: Response
): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  const text = await response.text();
  const trimmed = text.trimStart();

  if (
    !contentType.includes("application/json") &&
    (trimmed.startsWith("<!DOCTYPE") ||
      trimmed.startsWith("<!doctype") ||
      trimmed.startsWith("<html"))
  ) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Your session may have expired. Please refresh the page and sign in again."
      );
    }
    throw new Error(
      `Unexpected server page (HTTP ${response.status}). Please refresh and try again.`
    );
  }

  if (!trimmed) {
    throw new Error(`Empty server response (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Unexpected server response (HTTP ${response.status}). Please refresh and try again.`
    );
  }
}
