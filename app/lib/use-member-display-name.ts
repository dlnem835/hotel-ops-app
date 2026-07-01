"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/app/supabaseClient";
import {
  buildMemberDisplayNameResolver,
  type MemberDisplayNameResolver,
  type MemberNameRecord,
} from "@/app/lib/member-display-name";

export function useMemberDisplayNameResolver() {
  const [resolver, setResolver] = useState<MemberDisplayNameResolver | null>(null);

  useEffect(() => {
    let mounted = true;

    void supabase
      .from("team_members")
      .select("id, auth_user_id, username, first_name, last_name")
      .then(({ data, error }) => {
        if (!mounted || error) return;
        setResolver(buildMemberDisplayNameResolver((data || []) as MemberNameRecord[]));
      });

    return () => {
      mounted = false;
    };
  }, []);

  return resolver;
}

export function resolveMemberDisplayLabel(
  resolver: MemberDisplayNameResolver | null,
  stored: string | null | undefined,
  fallback = "Unknown"
): string {
  if (!stored) return fallback;
  if (!resolver) return stored;
  return resolver.resolveStoredValue(stored) || fallback;
}
