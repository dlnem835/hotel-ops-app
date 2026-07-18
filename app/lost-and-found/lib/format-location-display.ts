/**
 * Display-only formatting for Lost & Found location strings.
 * Does not change the stored `room_number` / location value.
 *
 * Examples:
 *   "315 · back office" → "315 · Back Office"
 *   "third floor housekeeping storage" → "Third Floor Housekeeping Storage"
 */
export function formatLostFoundLocationDisplay(value: string | null | undefined): string {
  if (value == null) return "";
  const trimmed = String(value).trim();
  if (!trimmed) return "";

  return trimmed.replace(/\S+/g, (token) => {
    if (token === "·" || token === "•") return token;
    if (/^\d+$/.test(token)) return token;
    return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
  });
}
