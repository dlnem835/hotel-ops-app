import type { EmailOtpType } from "@supabase/supabase-js";

export type RecoveryTokenHash = {
  tokenHash: string;
  type: EmailOtpType;
};

/**
 * Parse a first-party recovery URL query. Does not consume the token.
 */
export function parseRecoverySearchParams(
  search: string
): RecoveryTokenHash | null {
  const params = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const tokenHash = params.get("token_hash")?.trim() || "";
  const rawType = (params.get("type")?.trim() || "recovery") as EmailOtpType;
  if (!tokenHash) return null;
  if (rawType !== "recovery") return null;
  return { tokenHash, type: rawType };
}

/** Hash-fragment errors from a consumed/expired implicit recovery redirect. */
export function recoveryHashIndicatesFailure(hash: string): boolean {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return false;
  const params = new URLSearchParams(raw);
  return Boolean(
    params.get("error") ||
      params.get("error_code") ||
      params.get("error_description")
  );
}

const PASSWORD_RESET_SUCCESS_KEY = "one-eyrie.password-reset-success";

let succeededInThisDocument = false;

function readStoredPasswordResetSuccess(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(PASSWORD_RESET_SUCCESS_KEY) === "1";
  } catch {
    return false;
  }
}

/** True after this tab confirmed a password update with Supabase. */
export function passwordResetSucceededInSession(): boolean {
  return succeededInThisDocument || readStoredPasswordResetSuccess();
}

/** Persist success so sign-out / remounts cannot show an expired-link error. */
export function markPasswordResetSucceeded(): void {
  succeededInThisDocument = true;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PASSWORD_RESET_SUCCESS_KEY, "1");
  } catch {
    // Private mode or quota — in-memory flag still covers remounts.
  }
}

/** Drop the success marker when starting a new reset or leaving for login. */
export function clearPasswordResetSuccess(): void {
  succeededInThisDocument = false;
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(PASSWORD_RESET_SUCCESS_KEY);
  } catch {
    // ignore
  }
}
