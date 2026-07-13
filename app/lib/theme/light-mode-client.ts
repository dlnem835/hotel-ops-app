"use client";

import { supabase } from "@/app/supabaseClient";

/**
 * Fetches the server-revalidated Light Mode permission for the current session.
 * Returns false on any failure or missing session, so the UI fails closed to
 * Dark Mode. The authorized UUID is never sent to the client.
 */
export async function fetchLightModeAccess(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return false;
  }

  try {
    const response = await fetch("/api/theme/light-mode", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return false;
    }
    const body = (await response.json()) as { allowed?: boolean };
    return Boolean(body.allowed);
  } catch {
    return false;
  }
}
