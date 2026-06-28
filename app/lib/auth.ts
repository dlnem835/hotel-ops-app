import type { Session } from "@supabase/supabase-js";
import { waitForInitialAuthSession } from "@/app/lib/auth-session";
import { loginUrlWithNext } from "@/app/lib/login-return";
import { supabase } from "@/app/supabaseClient";

export { DESKTOP_LOGIN_DEFAULT } from "@/app/lib/login-return";

/** Read the current Supabase session (same client as desktop). */
export async function getClientSession(): Promise<Session | null> {
  if (typeof window === "undefined") return null;

  try {
    return await waitForInitialAuthSession();
  } catch {
    return null;
  }
}

/** Same logout flow used across desktop modules. */
export async function signOutAndRedirect(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch (error) {
    console.error("Sign out failed:", error);
  }

  if (typeof window !== "undefined" && isMobilePath(window.location.pathname)) {
    const path = `${window.location.pathname}${window.location.search}`;
    window.location.href = loginUrlWithNext(path);
    return;
  }

  window.location.href = "/login";
}

/** Send unauthenticated mobile users to login with a return path. */
export function redirectToLogin(returnTo?: string): void {
  const path =
    returnTo && returnTo.startsWith("/mobile")
      ? returnTo
      : typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/mobile";

  if (path.startsWith("/mobile")) {
    window.location.href = loginUrlWithNext(path);
    return;
  }

  window.location.href = "/login";
}

export function isMobilePath(path: string): boolean {
  return path === "/mobile" || path.startsWith("/mobile/");
}
