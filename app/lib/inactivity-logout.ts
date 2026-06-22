export const INACTIVITY_LOGOUT_MS = 30 * 60 * 1000;
export const INACTIVITY_WARNING_MS = 28 * 60 * 1000;
export const INACTIVITY_LOGOUT_MESSAGE =
  "You were logged out due to inactivity.";
export const INACTIVITY_LOGOUT_STORAGE_KEY = "one_eyrie_logout_message";

export const INACTIVITY_ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "click",
  "keydown",
  "scroll",
  "touchstart",
  "touchmove",
] as const;

/** Minimum gap between timer resets from high-frequency events like mousemove. */
export const INACTIVITY_ACTIVITY_THROTTLE_MS = 1000;

export function storeInactivityLogoutMessage() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    INACTIVITY_LOGOUT_STORAGE_KEY,
    INACTIVITY_LOGOUT_MESSAGE
  );
}

export function consumeInactivityLogoutMessage(): string | null {
  if (typeof window === "undefined") return null;
  const message = sessionStorage.getItem(INACTIVITY_LOGOUT_STORAGE_KEY);
  if (message) {
    sessionStorage.removeItem(INACTIVITY_LOGOUT_STORAGE_KEY);
  }
  return message;
}
