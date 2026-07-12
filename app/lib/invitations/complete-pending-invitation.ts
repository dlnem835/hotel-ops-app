"use client";

import { supabase } from "@/app/supabaseClient";

export async function completePendingInvitationIfNeeded(): Promise<boolean> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return false;
  }

  const response = await fetch("/api/invitations/complete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return false;
  }

  const body = (await response.json()) as { completed?: boolean };
  return Boolean(body.completed);
}
