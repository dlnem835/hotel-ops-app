export const DESKTOP_LOGIN_DEFAULT = "/pass-on-log";
export const MOBILE_LOGIN_DEFAULT = "/mobile";

const LOGIN_NEXT_KEY = "one_eyrie_login_next";

function isMobileLoginPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return pathname === "/mobile" || pathname.startsWith("/mobile/");
}

export function sanitizeLoginNext(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (!isMobileLoginPath(value)) return null;
  return value;
}

export function loginUrlWithNext(nextPath: string): string {
  const next = sanitizeLoginNext(nextPath) ?? MOBILE_LOGIN_DEFAULT;
  return `/login?next=${encodeURIComponent(next)}`;
}

export function captureLoginReturnFromUrl(): void {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const next = sanitizeLoginNext(params.get("next") ?? params.get("returnTo"));

  if (next) {
    sessionStorage.setItem(LOGIN_NEXT_KEY, next);
  }
}

export function peekLoginRedirect(): string {
  if (typeof window === "undefined") return DESKTOP_LOGIN_DEFAULT;

  const next = sanitizeLoginNext(sessionStorage.getItem(LOGIN_NEXT_KEY));
  if (next) return next;

  return DESKTOP_LOGIN_DEFAULT;
}

export function consumeLoginRedirect(): string {
  if (typeof window === "undefined") return DESKTOP_LOGIN_DEFAULT;

  const target = peekLoginRedirect();
  sessionStorage.removeItem(LOGIN_NEXT_KEY);
  return target;
}

/** @deprecated Use consumeLoginRedirect */
export function resolveLoginRedirect(): string {
  return consumeLoginRedirect();
}
