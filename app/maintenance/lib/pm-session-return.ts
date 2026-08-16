export const PM_SESSION_MOBILE_FROM = "mobile";
export const PM_SESSION_MOBILE_RETURN_PATH = "/mobile/pms";

export function isMobilePmSession(searchParams: URLSearchParams): boolean {
  return searchParams.get("from") === PM_SESSION_MOBILE_FROM;
}

export function pmSessionReturnPath(searchParams: URLSearchParams): string {
  const returnTo = searchParams.get("returnTo");
  if (
    returnTo &&
    /^\/maintenance\/pm-program\/\d+(?:\?from=mobile)?$/.test(returnTo)
  ) {
    return returnTo;
  }
  return isMobilePmSession(searchParams)
    ? PM_SESSION_MOBILE_RETURN_PATH
    : "/maintenance";
}

export function pmSessionBackLabel(searchParams: URLSearchParams): string {
  if (searchParams.get("returnTo")) return "Back to PM Program";
  return isMobilePmSession(searchParams) ? "Back to PMs" : "Back to Maintenance";
}

export function pmSessionUrl(
  occurrenceId: number,
  fromMobile = false,
  returnTo?: string
): string {
  const base = `/maintenance/pm/${occurrenceId}`;
  const params = new URLSearchParams();
  if (fromMobile) params.set("from", PM_SESSION_MOBILE_FROM);
  if (returnTo) params.set("returnTo", returnTo);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}
